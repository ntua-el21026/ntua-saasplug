FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_PUBLIC_BASE_URL=http://localhost:8080
ARG VITE_DEMO_LOGIN_PASSWORD=
ENV VITE_PUBLIC_BASE_URL=$VITE_PUBLIC_BASE_URL
ENV VITE_DEMO_LOGIN_PASSWORD=$VITE_DEMO_LOGIN_PASSWORD

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173
