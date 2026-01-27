# Contributing to ElasticScope

Thank you for your interest in contributing to ElasticScope! We welcome contributions from the community.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details** (OS, Node version, Elasticsearch version)
- **Error messages or logs**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear title and description**
- **Use case** - why this enhancement would be useful
- **Possible implementation** if you have ideas
- **Alternative solutions** you've considered

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes** following our coding standards
4. **Test your changes** thoroughly
5. **Update documentation** if needed
6. **Commit your changes** with clear commit messages
7. **Push to your fork** and submit a pull request

#### Pull Request Guidelines

- Follow the existing code style
- Write clear commit messages
- Update the README.md if needed
- Add tests if applicable
- Keep pull requests focused - one feature/fix per PR
- Link related issues in the PR description

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/ElasticScope.git
cd ElasticScope

# Install dependencies
npm install

# Start development server
npm run dev

# Start backend server
npm run server
```

### Project Structure

```
ElasticScope/
├── src/              # Frontend React application
│   ├── components/   # React components
│   ├── api/          # API clients
│   ├── hooks/        # Custom React hooks
│   ├── styles/       # CSS styles
│   ├── types/        # TypeScript types
│   └── utils/        # Utility functions
├── server/           # Backend Express server
└── data/             # Sample data
```

### Coding Standards

- Use TypeScript for type safety
- Follow React best practices
- Use functional components and hooks
- Write self-documenting code with clear variable names
- Add comments for complex logic
- Use Prettier for code formatting
- Use ESLint rules (when configured)

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Start with a capital letter
- Keep the first line under 72 characters
- Reference issues and pull requests when relevant

Examples:
```
Add document export functionality
Fix connection timeout issue #123
Update Docker configuration for better performance
```

### Testing

- Test your changes with different Elasticsearch versions
- Test with different data sets
- Test in different browsers
- Test the Docker setup if you modified it

### Documentation

- Update README.md for new features
- Update DOCKER_README.md for Docker-related changes
- Add JSDoc comments for new functions
- Update localization files (en.json, tr.json) for new UI text

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Questions?

Feel free to open an issue with the "question" label if you have any questions about contributing.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
