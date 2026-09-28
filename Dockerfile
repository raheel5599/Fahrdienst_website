FROM nginx:1.27-alpine
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY logo.svg /usr/share/nginx/html/logo.svg
COPY nginx.conf /etc/nginx/conf.d/default.conf
