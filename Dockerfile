# 배포 이미지.
#
# 빌드와 실행을 나눈 이유는 두 가지다. 뷰어 번들을 만들려면 esbuild를 받아야 하는데
# 그건 빌드 때만 필요하고, 최종 이미지에 남으면 공격 표면만 넓어진다.
#
# 이미지는 어느 플랫폼에도 올라간다 (Fly, Render, Railway, 클라우드타입 등).
# 특정 호스팅에 코드를 묶어두지 않으려는 것이다 — 나중에 옮길 일이 반드시 생긴다.

FROM node:22-slim AS build
WORKDIR /app

# 의존성 먼저. 소스가 바뀌어도 이 층은 캐시에서 재사용된다
COPY packages/report/package.json packages/report/package-lock.json* ./packages/report/
RUN cd packages/report && npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY . .

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

# 헬스체크는 플랫폼이 /healthz 를 두드리게 설정한다 (아래 참고).
# 이미지 안에서 curl을 돌리지 않는 이유는, 그러려면 curl을 깔아야 하고
# 최종 이미지에 도구가 하나 늘기 때문이다.

CMD ["node", "--experimental-strip-types", "apps/api/src/main.ts"]
