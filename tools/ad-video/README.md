# 늘봄사주 광고 영상 조립 도구 (`tools/ad-video`)

## 설치 및 실행 (5줄 요약)
1. 컴퓨터에 `ffmpeg`(및 `ffprobe`)와 `node`가 설치되어 있으면 별도 설치 없이 바로 돌아갑니다.
2. `tools/ad-video/input/nabi-love-01/` 처럼 소재 코드 폴더를 만들고 `scene1~scene3`(`.mp4` 또는 `.jpg`/`.png`), `voice.mp3`(또는 `.wav`), `subs.srt`, (선택) `bgm.mp3`를 넣습니다.
3. **폴더 1개 조립**: `node tools/ad-video/assemble.mjs tools/ad-video/input/nabi-love-01`
4. **폴더 여러 개 한 번에 조립**: `node tools/ad-video/assemble.mjs --all`
5. 완성된 `1080×1920` (9:16, 30fps, H.264 + AAC) 영상은 `tools/ad-video/output/<소재코드>.mp4` 에 저장됩니다.

## 자막 여백 및 글꼴 출처
- **자막 배치**: 첫 2초 후킹 자막은 화면 위 1/4 자리에 크게 나오고, 본문과 마지막 자막(「무료 사주 명식 먼저 보기」)은 아래 안전 영역(좌 110px · 우 180px · 아래 380px 여백)에 놓여 릴스·틱톡·클립·쇼츠의 오른쪽 버튼과 아래 설명란에 가려지지 않습니다.
- **사용 글꼴**: `fonts/NanumSquareRoundEB.ttf` (네이버 나눔스퀘어라운드 ExtraBold, 상업적 이용이 자유로운 **SIL Open Font License 1.1**, 라이선스 전문: `OFL.txt`, 원본 출처: NAVER 나눔글꼴 / `https://github.com/innks/NanumSquareRound`).
