FROM wordpress:6.5-apache

# Install WP-CLI and required utilities
RUN curl -o /usr/local/bin/wp https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar \
    && chmod +x /usr/local/bin/wp \
    && a2enmod rewrite \
    && apt-get update && apt-get install -y less mariadb-client curl \
    && rm -rf /var/lib/apt/lists/*

# WP-CLI needs a home directory
ENV HOME=/root
