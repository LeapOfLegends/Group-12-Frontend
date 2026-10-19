FROM nginx:1.28-alpine AS runtime

# Run npm ci and npm run build before building this image (Jenkins does this).
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/jetzy-trading/browser /usr/share/nginx/html

EXPOSE 80
