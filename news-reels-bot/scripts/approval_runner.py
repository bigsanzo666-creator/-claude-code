#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""승인 → 게시 구간을 명령 하나로 돌리는 실행기.

여태 이 구간은 `runbooks/approval_check.md`에 글로만 적혀 있어서, 세션마다
`python3 -c "..."` 긴 명령을 손으로 붙여넣어야 했다. 그러다 캡션을 빠뜨리거나
푸시 전에 게시해서 raw URL 404를 맞는 사고가 반복됐다. 그 절차를 그대로 코드로 옮긴 것이다.

사용법 (news-reels-bot/ 안에서 실행):

    python scripts/approval_runner.py status              # 지금 상태 한눈에
    python scripts/approval_runner.py send <아이템id>      # 텔레그램 승인 요청 전송
    python scripts/approval_runner.py watch               # 버튼 눌릴 때까지 폴링 → 승인되면 자동 게시
    python scripts/approval_runner.py approve <아이템id>   # 버튼 대신 채팅으로 승인받았을 때
    python scripts/approval_runner.py reject <아이템id>
    python scripts/approval_runner.py publish <아이템id>   # 승인된 건 즉시 게시
    python scripts/approval_runner.py maintain            # 2일 리마인드 + 5일 만료 삭제

필요 환경변수: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, IG_ACCESS_TOKEN, IG_BUSINESS_ACCOUNT_ID
(전부 클라우드 세션에만 주입된다. 로컬 PC에서는 status 말고는 못 돌린다.)
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import instagram_publish  # noqa: E402
import state_manager  # noqa: E402
import telegram_bot  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent      # news-reels-bot/
GIT_ROOT = REPO_ROOT.parent                              # 저장소 루트

# 인스타 캐러셀 자체 상한은 2~10장이지만, 운영 규칙으로 5~10장을 쓴다 (2026-08-17 확정).
MIN_CARDS, MAX_CARDS = 5, 10

WATCH_MINUTES_DEFAULT = 25
WATCH_INTERVAL_SEC = 10


class Stop(Exception):
    """사용자에게 그대로 보여줄 한 줄짜리 실패 사유."""


# ---------------------------------------------------------------- 공개 URL


def raw_base() -> str:
    """현재 체크아웃된 브랜치 기준의 raw.githubusercontent 주소를 만든다.

    Graph API는 로컬 파일을 안 받고 공개 HTTPS URL만 받는다. 예전에는 이 주소를
    손으로 적었는데, 브랜치명을 옛것으로 적어두고 게시했다가 404를 맞은 적이 있다.
    그래서 git이 아는 값에서 직접 만든다.
    """
    remote = _git("remote", "get-url", "origin")
    branch = _git("rev-parse", "--abbrev-ref", "HEAD")
    if branch == "HEAD":
        raise Stop("지금 브랜치가 detached HEAD입니다. 브랜치를 체크아웃한 뒤 다시 실행하세요.")

    slug = remote.removesuffix(".git")
    for prefix in ("https://github.com/", "git@github.com:", "ssh://git@github.com/"):
        if slug.startswith(prefix):
            slug = slug[len(prefix):]
            break
    else:
        raise Stop(f"origin이 깃허브 주소가 아닙니다: {remote}")

    return f"https://raw.githubusercontent.com/{slug}/{branch}/{REPO_ROOT.name}/"


def media_url(rel_path: str) -> str:
    """저장소 상대경로를 공개 raw URL로 바꾼다.

    경로에 한글이나 공백이 들어가면 urllib이 요청 단계에서 UnicodeEncodeError를 내므로
    (404가 아니라 엉뚱한 에러로 보인다) 여기서 미리 퍼센트 인코딩한다.
    """
    return raw_base() + urllib.parse.quote(rel_path)


def _git(*args: str) -> str:
    out = subprocess.run(
        ["git", "-C", str(GIT_ROOT), *args], capture_output=True, text=True
    )
    if out.returncode != 0:
        raise Stop(f"git {' '.join(args)} 실패: {out.stderr.strip()}")
    return out.stdout.strip()


def check_public(urls: list[str]) -> None:
    """게시 전에 raw URL이 실제로 열리는지 확인한다.

    푸시를 안 한 채로 게시하면 자식 컨테이너 생성에서 애매한 에러가 나는데,
    원인이 '푸시 안 함'이라는 걸 알아채는 데 매번 시간이 걸렸다. 먼저 여기서 잡는다.
    """
    missing = []
    for url in urls:
        req = urllib.request.Request(url, method="HEAD")
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                if resp.status != 200:
                    missing.append(url)
        except urllib.error.HTTPError:
            missing.append(url)
        except Exception as exc:
            raise Stop(f"raw URL 확인 중 네트워크 오류: {exc}")
    if missing:
        raise Stop(
            "이미지가 아직 깃허브에 없습니다. 먼저 커밋·푸시한 뒤 다시 실행하세요.\n"
            "  git add -A && git commit -m 'chore: 카드 이미지' && "
            f"git push -u origin {_git('rev-parse', '--abbrev-ref', 'HEAD')}\n"
            f"  열리지 않는 주소: {missing[0]}"
        )


# ---------------------------------------------------------------- 검증


def get_item(item_id: str) -> dict:
    item = state_manager.find(item_id)
    if not item:
        raise Stop(f"그런 아이템이 없습니다: {item_id}  (status 명령으로 목록 확인)")
    return item


def validate_for_send(item: dict) -> None:
    """텔레그램으로 보내기 전 확인. 여기서 막는 게 게시 후에 아는 것보다 낫다."""
    paths = item.get("media_paths") or []
    if item.get("post_type") != "carousel":
        raise Stop(f"이 실행기는 캐러셀만 다룹니다 (post_type={item.get('post_type')}).")
    if not MIN_CARDS <= len(paths) <= MAX_CARDS:
        raise Stop(f"카드가 {len(paths)}장입니다. {MIN_CARDS}~{MAX_CARDS}장이어야 합니다.")
    missing = [p for p in paths if not (REPO_ROOT / p).exists()]
    if missing:
        raise Stop(f"카드 이미지 파일이 없습니다: {missing[0]}")


def validate_for_publish(item: dict) -> None:
    validate_for_send(item)
    if not (item.get("caption") or "").strip():
        raise Stop(
            f"캡션이 비어 있어 게시할 수 없습니다 ({item['id']}).\n"
            "  캡션을 파일로 저장한 뒤:\n"
            f"  python scripts/approval_runner.py caption {item['id']} /tmp/caption.txt"
        )
    if item.get("posted_at"):
        raise Stop(f"이미 게시된 건입니다 ({item['id']}, media_id={item.get('instagram_media_id')}).")


# ---------------------------------------------------------------- 명령들


def cmd_status(_args) -> int:
    items = state_manager.load()
    if not items:
        print("등록된 아이템이 없습니다.")
        return 0
    print(f"{'id':12} {'상태':10} {'카드':4} {'캡션':4}  헤드라인")
    for it in items:
        cards = len(it.get("media_paths") or [])
        print(
            f"{it['id']:12} {it['status']:10} {cards:>3}장 "
            f"{'있음' if (it.get('caption') or '').strip() else ' 없음':4}  {it['headline'][:38]}"
        )
    waiting = [i for i in items if i["status"] == "pending"]
    approved = [i for i in items if i["status"] == "approved" and not i.get("posted_at")]
    print()
    print(f"승인 대기 중: {len(waiting)}건 / 승인됐지만 아직 게시 안 된 건: {len(approved)}건")
    for i in approved:
        print(f"  → 게시하려면: python scripts/approval_runner.py publish {i['id']}")
    return 0


def cmd_caption(args) -> int:
    text = Path(args.file).read_text(encoding="utf-8").strip()
    if not text:
        raise Stop("캡션 파일이 비어 있습니다.")
    if text.startswith("(") and text.endswith(")"):
        # 2026-08-17에 "(캡션 내용)"이 글자 그대로 들어온 적이 있다.
        raise Stop("캡션이 자리표시자처럼 보입니다. 실제 캡션인지 확인하세요.")
    state_manager.update(args.item_id, caption=text)
    print(f"캡션 저장 완료 ({len(text)}자)")
    return 0


def cmd_send(args) -> int:
    item = get_item(args.item_id)
    validate_for_send(item)
    if not (item.get("caption") or "").strip():
        print("⚠️ 캡션이 없습니다. 승인 화면에 경고 문구가 대신 붙습니다.")
    msg_id = telegram_bot.send_carousel_preview(item, item["media_paths"])
    state_manager.set_telegram_message_id(item["id"], msg_id)
    print(f"텔레그램 전송 완료 (메시지 id {msg_id}). 버튼을 기다리려면:")
    print("  python scripts/approval_runner.py watch")
    return 0


def _publish(item: dict) -> str:
    validate_for_publish(item)
    urls = [media_url(p) for p in item["media_paths"]]
    check_public(urls)
    media_id = instagram_publish.publish_carousel(urls, item["caption"])
    state_manager.mark_posted(item["id"], media_id)
    return media_id


def cmd_publish(args) -> int:
    item = get_item(args.item_id)
    if item["status"] not in ("approved", "posted"):
        raise Stop(f"승인된 건이 아닙니다 (현재 상태: {item['status']}).")
    media_id = _publish(item)
    link = ""
    try:
        link = instagram_publish._get(media_id, {"fields": "permalink"}).get("permalink", "")
    except Exception:
        pass
    print(f"게시 완료: {media_id} {link}")
    _notify(f"✅ 게시 완료\n{item['headline']}\n{link}")
    return 0


def _notify(text: str) -> None:
    try:
        telegram_bot.send_text(text)
    except Exception as exc:
        print(f"(텔레그램 알림 실패 — 게시 자체에는 영향 없음: {exc})")


def _handle_response(item_id: str, approved: bool) -> None:
    item = state_manager.mark_responded(item_id, approved)
    if not item:
        print(f"⚠️ 모르는 아이템의 버튼이 눌렸습니다: {item_id} (무시)")
        return
    print(f"버튼: {item_id} {'승인' if approved else '거부'}")
    if not approved:
        return
    try:
        media_id = _publish(item)
    except Stop as exc:
        print(f"게시 보류: {exc}")
        _notify(f"⛔ 승인은 받았지만 게시하지 못했습니다.\n{exc}")
        return
    except Exception as exc:
        print(f"게시 실패: {exc}")
        # approved 상태로 남겨두면 다음 실행에서 재시도된다 (runbook 6번).
        _notify(f"⛔ 게시 실패 — 승인 상태로 남겨둡니다.\n{exc}")
        return
    link = ""
    try:
        link = instagram_publish._get(media_id, {"fields": "permalink"}).get("permalink", "")
    except Exception:
        pass
    print(f"게시 완료: {media_id} {link}")
    _notify(f"✅ 게시 완료\n{item['headline']}\n{link}")


def cmd_watch(args) -> int:
    """버튼이 눌릴 때까지 폴링한다. 승인이면 그 자리에서 게시까지 한다."""
    deadline = time.time() + args.minutes * 60
    target = args.item_id
    print(f"버튼을 기다립니다 (최대 {args.minutes}분). 승인되면 바로 게시합니다.", flush=True)
    while time.time() < deadline:
        try:
            responses = telegram_bot.poll_callback_responses()
        except Exception as exc:
            print(f"(폴링 오류, 계속 재시도: {exc})", flush=True)
            responses = []
        for r in responses:
            _handle_response(r["item_id"], r["approved"])
            if target and r["item_id"] == target:
                return 0
        time.sleep(WATCH_INTERVAL_SEC)
    print("시간 초과 — 아직 버튼이 눌리지 않았습니다. 다시 실행하면 이어서 기다립니다.")
    return 0


def cmd_approve(args) -> int:
    """버튼 대신 채팅으로 '게시해줘'라고 했을 때 쓰는 경로."""
    get_item(args.item_id)
    _handle_response(args.item_id, True)
    return 0


def cmd_reject(args) -> int:
    get_item(args.item_id)
    _handle_response(args.item_id, False)
    return 0


def cmd_maintain(_args) -> int:
    for item in state_manager.items_needing_reminder():
        telegram_bot.send_reminder(item)
        state_manager.mark_reminded(item["id"])
        print(f"리마인드 전송: {item['id']}")
    for item in state_manager.items_to_delete():
        telegram_bot.send_deletion_notice(item)
        state_manager.mark_deleted(item["id"])
        print(f"만료 삭제: {item['id']}")
    print("정리 완료.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="승인 → 게시 실행기")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="아이템 상태 목록").set_defaults(func=cmd_status)

    p = sub.add_parser("caption", help="캡션 파일을 아이템에 넣는다")
    p.add_argument("item_id")
    p.add_argument("file")
    p.set_defaults(func=cmd_caption)

    p = sub.add_parser("send", help="텔레그램 승인 요청 전송")
    p.add_argument("item_id")
    p.set_defaults(func=cmd_send)

    p = sub.add_parser("watch", help="버튼 폴링 → 승인 시 자동 게시")
    p.add_argument("item_id", nargs="?", default=None, help="이 아이템 응답을 받으면 종료")
    p.add_argument("--minutes", type=int, default=WATCH_MINUTES_DEFAULT)
    p.set_defaults(func=cmd_watch)

    p = sub.add_parser("publish", help="승인된 건 즉시 게시")
    p.add_argument("item_id")
    p.set_defaults(func=cmd_publish)

    p = sub.add_parser("approve", help="채팅 승인 → 게시")
    p.add_argument("item_id")
    p.set_defaults(func=cmd_approve)

    p = sub.add_parser("reject", help="거부 처리")
    p.add_argument("item_id")
    p.set_defaults(func=cmd_reject)

    sub.add_parser("maintain", help="리마인드 + 만료 삭제").set_defaults(func=cmd_maintain)

    args = parser.parse_args()
    try:
        return args.func(args)
    except Stop as exc:
        print(f"⛔ {exc}")
        return 1
    except KeyError as exc:
        print(f"⛔ 환경변수가 없습니다: {exc}. 클라우드 세션에서 실행하세요.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
