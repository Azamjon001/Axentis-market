
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import ErrorBoundary from "./components/ErrorBoundary.tsx";
  import "./index.css";
  import "./tailwind.css";
  import "./dark-theme.css";

  // ♻️ Самолечение после деплоя: браузер мог закэшировать старый index.html,
  // который ссылается на чанки с уже несуществующими именами (vite меняет
  // хэши при каждой сборке). Тогда ленивая подгрузка вкладки падает и
  // пользователь видит «Что-то пошло не так». Ловим это событие vite и один
  // раз принудительно перезагружаем страницу с обходом кэша.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const KEY = "chunk_reload_at";
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last > 15000) {
      sessionStorage.setItem(KEY, String(Date.now()));
      window.location.reload();
    }
  });

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
