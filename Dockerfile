# TARIQ Fahrdienst production image
FROM nginx:1.27-alpine
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY logo.svg /usr/share/nginx/html/logo.svg
COPY fahrdienst-hero.jpg /usr/share/nginx/html/fahrdienst-hero.jpg
COPY assets /usr/share/nginx/html/assets
COPY nginx.conf /etc/nginx/conf.d/default.conf

# production redeploy refresh 2026-09-29
