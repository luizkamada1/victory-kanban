"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "victory_kanban_header_recolhido";

// Compartilhado entre todas as telas com Kanban, pra manter o mesmo estado
// (recolhido/expandido) ao navegar entre elas dentro da mesma sessão.
export function useHeaderRecolhido() {
  const [recolhido, setRecolhido] = useState(false);

  useEffect(() => {
    const salvo = window.sessionStorage.getItem(STORAGE_KEY);
    if (salvo === "1") setRecolhido(true);
  }, []);

  function alternar() {
    setRecolhido((atual) => {
      const novo = !atual;
      window.sessionStorage.setItem(STORAGE_KEY, novo ? "1" : "0");
      return novo;
    });
  }

  return { recolhido, alternar };
}
