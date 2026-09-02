import { useEffect, useState } from 'react';
import { listarFila, onFilaMudou, processQueue } from './syncQueue';
import type { ItemFila } from './db';

export function useSyncQueue() {
  const [itens, setItens] = useState<ItemFila[]>([]);

  useEffect(() => {
    let ativo = true;
    function recarregar() {
      listarFila().then((lista) => {
        if (ativo) setItens(lista);
      });
    }
    recarregar();
    const unsubscribe = onFilaMudou(recarregar);
    return () => {
      ativo = false;
      unsubscribe();
    };
  }, []);

  return {
    itens,
    pendentes: itens.length,
    comErro: itens.filter((i) => i.ultimoErro).length,
    tentarAgora: () => void processQueue(),
  };
}
