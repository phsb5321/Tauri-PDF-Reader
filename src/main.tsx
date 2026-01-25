import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { RepositoryProvider } from './adapters/context/repository-context';
import { createRepositories } from './adapters/create-repositories';
import { initDatabase } from './lib/db-init';
import './styles/index.css';
// PDF.js text layer CSS for selectable text
import 'pdfjs-dist/web/pdf_viewer.css';

// Initialize database then render app
async function bootstrap() {
  try {
    await initDatabase();
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }

  const repositories = createRepositories();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RepositoryProvider repositories={repositories}>
        <App />
      </RepositoryProvider>
    </React.StrictMode>
  );
}

bootstrap();
