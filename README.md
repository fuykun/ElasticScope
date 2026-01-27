<h1 align="center">ElasticScope</h1>

<p align="center">
  <strong>A modern, powerful web UI for Elasticsearch</strong>
</p>

<p align="center">
  <a href="https://github.com/fuykun/ElasticScope/stargazers"><img src="https://img.shields.io/github/stars/fuykun/ElasticScope?style=social" alt="GitHub stars" /></a>
  <a href="https://github.com/fuykun/ElasticScope/fork"><img src="https://img.shields.io/github/forks/fuykun/ElasticScope?style=social" alt="GitHub forks" /></a>
  <a href="https://hub.docker.com/r/fuykun/elasticscope"><img src="https://img.shields.io/docker/pulls/fuykun/elasticscope?style=social&logo=docker" alt="Docker Pulls" /></a>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Elasticsearch-8.x-005571?style=flat-square&logo=elasticsearch" alt="Elasticsearch" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## Overview

**ElasticScope** is a feature-rich, open-source web application for managing and exploring Elasticsearch clusters. Built with React and TypeScript, it provides an intuitive interface for developers and data engineers to interact with their Elasticsearch data.

Unlike heavyweight alternatives, ElasticScope is lightweight, fast, and easy to deploy. It runs entirely in your browser with a minimal Node.js backend that proxies requests to your Elasticsearch cluster.

## Features

### API Proxy (No CORS Issues)
- Built-in Node.js proxy server eliminates CORS problems
- Connect to any Elasticsearch cluster without browser restrictions
- Support for self-signed SSL certificates

### Multi-Connection Management
- Save and switch between multiple Elasticsearch connections
- Color-coded connections for easy identification
- Support for basic authentication

### Document Comparison
- Compare any two documents side-by-side with diff view
- Highlight differences between document versions
- Useful for debugging and auditing changes

### Cross-Server Document Copy
- Copy documents between different Elasticsearch clusters
- Migrate data across environments (dev, staging, prod)
- Preserve document structure during transfer

### Customizable Document List
- Select which fields to display in the table view
- Reorder and resize columns
- Pin frequently accessed fields in JSON viewer
- Save column preferences per index

### Index Management
- Browse all indices with health status indicators
- View index settings, mappings, and statistics
- Create and delete indices
- Manage index aliases

### Document Explorer
- Paginated document browsing with customizable page size
- Sort by any field
- Expandable JSON viewer with syntax highlighting
- Edit documents inline with JSON validation

### REST Console
- Execute raw Elasticsearch queries
- Save and load frequently used queries
- Syntax highlighting and JSON formatting
- Response time and status tracking

## Screenshots

<details>
<summary>Click to view screenshots</summary>

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Document Viewer
![Document Viewer](docs/screenshots/document-viewer.png)

### Document Comparison
![Document Comparison](docs/screenshots/comparison.png)

### REST Console
![REST Console](docs/screenshots/rest-console.png)

</details>

## Installation

### Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn**
- **Elasticsearch** 7.x or 8.x (local or remote)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/fuykun/ElasticScope.git
cd elasticscope

# Install dependencies
npm install

# Start the application
npm run dev:all
```

The application will be available at `http://localhost:5173`

### Docker

#### From Docker Hub (Recommended)

```bash
# Pull and run the latest version
docker run -d \
  --name elasticscope \
  -p 3001:3001 \
  -v elasticscope-data:/app/data \
  fuykun/elasticscope:latest

# Access at http://localhost:3001
```

Or with Docker Compose:

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

#### Build from Source

**Quick Start with Docker Compose:**

```bash
# Run with Docker Compose (recommended)
docker compose up -d

# Access at http://localhost:3001
```

**Development Mode:**

```bash
# Run with hot-reload enabled
docker compose --profile dev up elasticscope-dev
```

**With Local Elasticsearch (for testing):**

```bash
# Start ElasticScope with a local Elasticsearch instance
docker compose --profile with-es up -d

# Elasticsearch will be available at http://localhost:9200
# ElasticScope at http://localhost:3001
```

When adding a connection in ElasticScope, use these settings:

| Field | Value |
|-------|-------|
| URL | `http://elasticsearch:9200` |
| Username | *(leave empty)* |
| Password | *(leave empty)* |

> **Note:** Use `elasticsearch:9200` (container name) instead of `localhost:9200` because ElasticScope runs inside the Docker network.

**Build and Run Manually:**

```bash
# Build the image
docker build -t elasticscope .

# Run the container
docker run -d \
  --name elasticscope \
  -p 3001:3001 \
  -v elasticscope-data:/app/data \
  elasticscope

# Access at http://localhost:3001
```

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
npm run start

# Or build and start in one command
npm run start:prod
```

## Usage

### Adding a Connection

1. Click the connection selector in the header
2. Click "Add New Connection"
3. Enter your Elasticsearch URL (e.g., `https://localhost:9200`)
4. Provide credentials if required
5. Choose a name and color for easy identification
6. Click "Connect"

### Searching Documents

- Select an index from the sidebar
- Use the search bar with simple text or JSON query mode
- Select which fields to search in
- Click on a document to expand and view details

### Comparing Documents

1. Select two documents using the checkboxes
2. Click the "Compare" button in the toolbar
3. View differences highlighted in the diff viewer

### Copying Documents Between Clusters

1. Connect to your source Elasticsearch cluster
2. Navigate to the document you want to copy
3. Click the "Copy" button on the document row
4. Select the target connection and index
5. Confirm the copy operation

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `VITE_API_URL` | API URL for frontend | `http://localhost:3001/api` |

### Elasticsearch Connection Options

ElasticScope supports:
- HTTP and HTTPS connections
- Basic authentication (username/password)
- Self-signed SSL certificates
- Custom CA certificates

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Express.js, Node.js |
| Database | SQLite (better-sqlite3) |
| ES Client | @elastic/elasticsearch |
| UI Icons | Lucide React |
| Diff View | react-diff-viewer-continued |

## Project Structure

```
elasticscope/
├── src/                     # Frontend source
│   ├── api/                 # API client functions
│   ├── components/          # React components
│   ├── constants/           # Application constants
│   ├── hooks/               # Custom React hooks
│   ├── styles/              # CSS styles
│   ├── types/               # TypeScript types
│   └── utils/               # Utility functions
├── server/                  # Backend source
│   ├── index.ts             # Express server (API proxy)
│   └── database.ts          # SQLite database
├── public/                  # Static assets
├── data/                    # SQLite database files
└── docs/                    # Documentation
```

## Contributing

Contributions are welcome! Please read our contributing guidelines for details.

### Development Setup

```bash
# Fork and clone the repo
git clone https://github.com/fuykun/ElasticScope.git

# Install dependencies
cd elasticscope
npm install

# Start development server
npm run dev:all

# Run type checking
npm run typecheck

# Build for production
npm run build
```

### Code Style

- Use TypeScript strict mode
- Follow the existing code patterns
- Use Lucide icons (no emojis in UI)
- Keep components small and focused

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Elasticsearch](https://www.elastic.co/elasticsearch/) - The powerful search engine
- [React](https://reactjs.org/) - UI framework
- [Lucide](https://lucide.dev/) - Beautiful icons
- [Vite](https://vitejs.dev/) - Lightning fast build tool

---

<p align="center">
  Made with care for the Elasticsearch community
</p>

<p align="center">
  <a href="https://github.com/fuykun/ElasticScope">
    <img src="https://img.shields.io/badge/GitHub-fuykun%2FElasticScope-181717?style=for-the-badge&logo=github" alt="GitHub" />
  </a>
</p>

<p align="center">
  If you find this project useful, please consider giving it a ⭐
</p>


