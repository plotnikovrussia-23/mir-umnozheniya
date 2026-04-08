#!/bin/zsh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

clear
echo "Запускаю игру 'Мир умножения'..."
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "Не найден npm."
  echo "Нужно установить Node.js, а потом попробовать ещё раз."
  echo
  read "?Нажми Enter, чтобы закрыть окно."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Подготавливаю игру в первый раз..."
  npm install
  if [ $? -ne 0 ]; then
    echo
    echo "Не получилось установить нужные файлы."
    read "?Нажми Enter, чтобы закрыть окно."
    exit 1
  fi
fi

echo "Сейчас откроется браузер с игрой."
echo "Если браузер не открылся сам, посмотри ссылку в этом окне."
echo

npm run dev -- --host 127.0.0.1 --open
