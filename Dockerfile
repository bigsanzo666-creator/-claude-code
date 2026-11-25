# 배포 이미지.
#
# 빌드와 실행을 나눈 이유는 두 가지다. 뷰어 번들을 만들려면 esbuild를 받아야 하는데
# 그건 빌드 때만 필요하고, 최종 이미지에 남으면 공격 표면만 넓어진다.
#
# 이미지는 어느 플랫폼에도 올라간다 (Fly, Render, Railway, 클라우드타입 등).
# 특정 호스팅에 코드를 묶어두지 않으려는 것이다 — 나중에 옮길 일이 반드시 생긴다.

FROM node:22-slim AS build
WORKDIR /app

COPY packages ./packages
COPY apps ./apps

# 의존성이 있는 패키지를 **찾아서** 설치한다.
#
# 전에는 `packages/report` 하나만 손으로 적어 뒀는데, `packages/store` 를 만들면서
# 거기 붙인 `pg` 를 여기 추가하는 것을 잊었다. 빌드는 통과하고 **실행할 때 죽는다** —
# 도커 빌드는 앱을 돌려보지 않기 때문이다. 배포가 실패하고 나서야 알았다.
#
# 목록을 손으로 관리하는 한 같은 사고가 또 난다. 그래서 목록을 없앴다.
RUN set -eu; \
    for pkg in packages/*/package.json; do \
      dir=$(dirname "$pkg"); \
      if grep -q '"dependencies"' "$pkg"; then \
        echo "==> 의존성 설치: $dir"; \
        (cd "$dir" && npm install --omit=dev --no-audit --no-fund); \
      fi; \
    done

# 뷰어 번들 생성 → apps/manse-viewer/index.html
RUN node apps/manse-viewer/build.mjs

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# 루트로 돌리지 않는다. node 이미지에 이미 있는 비특권 사용자를 쓴다
COPY --from=build --chown=node:node /app /app
USER node

EXPOSE 3000
ENV PORT=3000

# 헬스체크는 플랫폼이 /healthz 를 두드리게 설정한다 (render.yaml 참고).
# 이미지 안에서 curl을 돌리지 않는 이유는, 그러려면 curl을 깔아야 하고
# 최종 이미지에 도구가 하나 늘기 때문이다.

CMD ["node", "--experimental-strip-types", "apps/api/src/main.ts"]
