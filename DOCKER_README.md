<h1 align="center">ElasticScope</h1>

<p align="center">
  <strong>A modern, powerful web UI for Elasticsearch</strong>
</p>

<p align="center">
  <a href="https://github.com/fuykun/ElasticScope"><img src="https://img.shields.io/github/stars/fuykun/ElasticScope?style=social" alt="GitHub stars" /></a>
  <a href="https://hub.docker.com/r/fuykun/elasticscope"><img src="https://img.shields.io/docker/pulls/fuykun/elasticscope" alt="Docker Pulls" /></a>
  <a href="https://hub.docker.com/r/fuykun/elasticscope"><img src="https://img.shields.io/docker/v/fuykun/elasticscope?sort=semver" alt="Docker Version" /></a>
</p>

---

## Quick Start

```bash
docker run -d \
  --name elasticscope \
  -p 3001:3001 \
  -v elasticscope-data:/app/data \
  fuykun/elasticscope:latest
```

Then open **http://localhost:3001** in your browser.

---

## Docker Compose

```yaml
services:
  elasticscope:
    image: fuykun/elasticscope:latest
    container_name: elasticscope
    ports:
      - "3001:3001"
    volumes:
      - elasticscope-data:/app/data
    restart: unless-stopped

volumes:
  elasticscope-data:
```

---

## Features

- 🔌 **Multi-Connection Management** - Save and switch between multiple Elasticsearch clusters
- 📊 **Document Explorer** - Browse, search, and edit documents with ease
- 🔍 **REST Console** - Execute raw Elasticsearch queries with syntax highlighting
- 📋 **Document Comparison** - Compare any two documents side-by-side with diff view
- 📦 **Cross-Server Copy** - Copy documents between different Elasticsearch clusters
- 🎨 **Customizable Views** - Select which fields to display, pin favorites
- 🌐 **Multi-language** - English and Turkish support

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `production` |

---

## Volumes

| Path | Description |
|------|-------------|
| `/app/data` | SQLite database for saved connections and queries |

---

## Connecting to Elasticsearch

When adding a connection in ElasticScope:

**Local Elasticsearch (same Docker network):**
```
URL: http://elasticsearch:9200
```

**Remote Elasticsearch:**
```
URL: https://your-elasticsearch-host:9200
Username: your-username
Password: your-password
```

---

## Links

- 📖 **Documentation:** [GitHub](https://github.com/fuykun/ElasticScope)
- 🐛 **Issues:** [GitHub Issues](https://github.com/fuykun/ElasticScope/issues)
- 📜 **License:** MIT

---

<p align="center">
  Made with ❤️ for the Elasticsearch community
</p>
