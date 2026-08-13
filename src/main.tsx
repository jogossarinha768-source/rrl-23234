import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import AppContainer from './AppContainer.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppContainer />
  </StrictMode>,
);
