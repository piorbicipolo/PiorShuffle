// app.js

// Estado global simples
let quadra = null;
let nextGlobalId = 1;
let partidaAtualId = null;

const STORAGE_KEY = "polo_quadra_estado_v1";

// Tipos de conflito
const TipoConflito = {
  NAO_MESMO_TIME: "NAO_MESMO_TIME",
  NAO_MESMA_PARTIDA: "NAO_MESMA_PARTIDA",
};

// Utilidades básicas
function gerarId() {
  const id = nextGlobalId++;
  console.log("[LOG] gerarId ->", id);
  return id;
}

function salvarEstado() {
  try {
    const estado = {
      quadra,
      nextGlobalId,
      partidaAtualId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    console.log("[LOG] salvarEstado ->", estado);
  } catch (e) {
    console.error("[LOG][ERRO] salvarEstado:", e);
  }
}

function carregarEstado() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    console.log("[LOG] carregarEstado -> nenhum estado salvo");
    return;
  }
  try {
    const estado = JSON.parse(raw);
    quadra = estado.quadra;
    nextGlobalId = estado.nextGlobalId || 1;
    partidaAtualId = estado.partidaAtualId || null;
    console.log("[LOG] carregarEstado ->", estado);
  } catch (e) {
    console.error("[LOG][ERRO] carregarEstado:", e);
  }
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  console.log("[LOG] DOMContentLoaded - inicializando app Bike Polo");

  // Elementos
  const quadraNomeInput = document.getElementById("quadraNome");
  const btnCriarQuadra = document.getElementById("btnCriarQuadra");
  const quadraInfo = document.getElementById("quadraInfo");

  const formJogador = document.getElementById("formJogador");
  const jogadorNomeInput = document.getElementById("jogadorNome");
  const btnAdicionarJogador = document.getElementById("btnAdicionarJogador");
  const tabelaJogadoresBody = document.querySelector("#tabelaJogadores tbody");

  const selectJogadorA = document.getElementById("selectJogadorA");
  const selectJogadorB = document.getElementById("selectJogadorB");
  const selectTipoConflito = document.getElementById("selectTipoConflito");
  const btnAdicionarConflito = document.getElementById("btnAdicionarConflito");
  const listaConflitos = document.getElementById("listaConflitos");

  const chkPriorizarMenosJogos = document.getElementById("chkPriorizarMenosJogos");
  const btnGerarPartida = document.getElementById("btnGerarPartida");
  const erroPartida = document.getElementById("erroPartida");

  const partidaConteudo = document.getElementById("partidaConteudo");
  const placarTimeAInput = document.getElementById("placarTimeA");
  const placarTimeBInput = document.getElementById("placarTimeB");
  const btnFinalizarPartida = document.getElementById("btnFinalizarPartida");

  const tabelaHistoricoBody = document.querySelector("#tabelaHistorico tbody");

  // Funções de renderização
  function atualizarQuadraInfo() {
    if (!quadra) {
      quadraInfo.textContent = "Nenhuma quadra criada.";
      return;
    }
    quadraInfo.textContent = `Quadra: ${quadra.nome} | Pessoas: ${quadra.jogadores.length} | Partidas: ${quadra.partidas.length}`;
  }

  function atualizarSelectJogadores() {
    [selectJogadorA, selectJogadorB].forEach((select) => {
      select.innerHTML = "";
      if (!quadra) return;
      quadra.jogadores.forEach((j) => {
        const opt = document.createElement("option");
        opt.value = j.id;
        opt.textContent = j.nome;
        select.appendChild(opt);
      });
    });
  }

  function renderJogadores() {
    tabelaJogadoresBody.innerHTML = "";
    if (!quadra) return;

    quadra.jogadores.forEach((jogador) => {
      const tr = document.createElement("tr");

      const tdNome = document.createElement("td");
      tdNome.textContent = jogador.nome;

      const tdJogos = document.createElement("td");
      tdJogos.textContent = jogador.jogos_jogados;

      const tdAcoes = document.createElement("td");
      const btnRemover = document.createElement("button");
      btnRemover.textContent = "Remover";
      btnRemover.addEventListener("click", () => {
        removerJogador(jogador.id);
      });

      tdAcoes.appendChild(btnRemover);

      tr.appendChild(tdNome);
      tr.appendChild(tdJogos);
      tr.appendChild(tdAcoes);

      tabelaJogadoresBody.appendChild(tr);
    });
  }

  function renderConflitos() {
    listaConflitos.innerHTML = "";
    if (!quadra) return;

    quadra.conflitos.forEach((conf) => {
      const li = document.createElement("li");
      const jogadorA = quadra.jogadores.find((j) => j.id === conf.jogadorA_id);
      const jogadorB = quadra.jogadores.find((j) => j.id === conf.jogadorB_id);

      let tipoLabel = "";
      if (conf.tipo === TipoConflito.NAO_MESMO_TIME) {
        tipoLabel = "não mesmo time";
      } else {
        tipoLabel = "não mesma partida";
      }

      const texto = document.createElement("span");
      texto.textContent = `${jogadorA?.nome || "?"} ↔ ${
        jogadorB?.nome || "?"
      } (${tipoLabel})`;

      const btnRemover = document.createElement("button");
      btnRemover.textContent = "x";
      btnRemover.addEventListener("click", () => {
        removerConflito(conf.id);
      });

      li.appendChild(texto);
      li.appendChild(btnRemover);
      listaConflitos.appendChild(li);
    });

    console.log("[LOG] renderConflitos ->", quadra.conflitos);
  }

  function renderPartidaAtual() {
    partidaConteudo.innerHTML = "";

    if (!quadra || partidaAtualId == null) {
      const p = document.createElement("p");
      p.textContent = "Nenhuma partida gerada ainda.";
      partidaConteudo.appendChild(p);
      btnFinalizarPartida.disabled = true;
      placarTimeAInput.value = "";
      placarTimeBInput.value = "";
      placarTimeAInput.disabled = true;
      placarTimeBInput.disabled = true;
      return;
    }

    const partida = quadra.partidas.find((p) => p.id === partidaAtualId);
    if (!partida) {
      const p = document.createElement("p");
      p.textContent = "Partida não encontrada.";
      partidaConteudo.appendChild(p);
      btnFinalizarPartida.disabled = true;
      placarTimeAInput.disabled = true;
      placarTimeBInput.disabled = true;
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.classList.add("partida-times");

    const timeABox = document.createElement("div");
    timeABox.classList.add("partida-time");
    const timeATitle = document.createElement("h3");
    timeATitle.innerHTML = `Time A <span class="badge-time">3×3</span>`;
    const ulA = document.createElement("ul");
    partida.timeA.forEach((j) => {
      const li = document.createElement("li");
      li.textContent = j.nome;
      ulA.appendChild(li);
    });
    timeABox.appendChild(timeATitle);
    timeABox.appendChild(ulA);

    const timeBBox = document.createElement("div");
    timeBBox.classList.add("partida-time");
    const timeBTitle = document.createElement("h3");
    timeBTitle.innerHTML = `Time B <span class="badge-time">3×3</span>`;
    const ulB = document.createElement("ul");
    partida.timeB.forEach((j) => {
      const li = document.createElement("li");
      li.textContent = j.nome;
      ulB.appendChild(li);
    });
    timeBBox.appendChild(timeBTitle);
    timeBBox.appendChild(ulB);

    wrapper.appendChild(timeABox);
    wrapper.appendChild(timeBBox);

    partidaConteudo.appendChild(wrapper);

    // Placar
    placarTimeAInput.disabled =
      partida.status === "finalizada" ? true : false;
    placarTimeBInput.disabled =
      partida.status === "finalizada" ? true : false;

    placarTimeAInput.value =
      partida.golsTimeA != null ? partida.golsTimeA : "";
    placarTimeBInput.value =
      partida.golsTimeB != null ? partida.golsTimeB : "";

    btnFinalizarPartida.disabled = partida.status === "finalizada";

    console.log("[LOG] renderPartidaAtual ->", partida);
  }

  function renderHistorico() {
    if (!tabelaHistoricoBody) return;
    tabelaHistoricoBody.innerHTML = "";
    if (!quadra) return;

    const partidasFinalizadas = quadra.partidas
      .filter((p) => p.status === "finalizada")
      .sort((a, b) => a.id - b.id);

    partidasFinalizadas.forEach((partida, index) => {
      const tr = document.createElement("tr");

      const tdIdx = document.createElement("td");
      tdIdx.textContent = index + 1;

      const nomesTimeA = partida.timeA.map((j) => j.nome).join(", ");
      const nomesTimeB = partida.timeB.map((j) => j.nome).join(", ");

      const golsA = partida.golsTimeA ?? 0;
      const golsB = partida.golsTimeB ?? 0;
      const saldo = golsA - golsB;

      const tdTimeA = document.createElement("td");
      tdTimeA.textContent = nomesTimeA;

      const tdGolsA = document.createElement("td");
      tdGolsA.textContent = golsA;

      const tdTimeB = document.createElement("td");
      tdTimeB.textContent = nomesTimeB;

      const tdGolsB = document.createElement("td");
      tdGolsB.textContent = golsB;

      const tdSaldo = document.createElement("td");
      tdSaldo.textContent = saldo;

      tr.appendChild(tdIdx);
      tr.appendChild(tdTimeA);
      tr.appendChild(tdGolsA);
      tr.appendChild(tdTimeB);
      tr.appendChild(tdGolsB);
      tr.appendChild(tdSaldo);

      tabelaHistoricoBody.appendChild(tr);
    });

    console.log("[LOG] renderHistorico ->", partidasFinalizadas);
  }

  // Lógica principal

  function criarOuResetarQuadra() {
    const nome = quadraNomeInput.value.trim() || "Quadra sem nome";

    quadra = {
      id: gerarId(),
      nome,
      jogadores: [],
      conflitos: [],
      partidas: [],
      proxima_partida_id: 1,
    };
    partidaAtualId = null;

    console.log("[LOG] criarOuResetarQuadra ->", quadra);

    atualizarQuadraInfo();
    renderJogadores();
    atualizarSelectJogadores();
    renderConflitos();
    renderPartidaAtual();
    renderHistorico();
    salvarEstado();
  }

  function adicionarJogador() {
    if (!quadra) {
      alert("Crie uma quadra primeiro.");
      return;
    }
    const nome = jogadorNomeInput.value.trim();
    if (!nome) return;

    const jogador = {
      id: gerarId(),
      nome,
      jogos_jogados: 0,
    };
    quadra.jogadores.push(jogador);
    jogadorNomeInput.value = "";

    console.log("[LOG] adicionarPessoa ->", jogador);

    atualizarQuadraInfo();
    renderJogadores();
    atualizarSelectJogadores();
    renderConflitos();
    renderPartidaAtual();
    renderHistorico();
    salvarEstado();

    jogadorNomeInput.focus();
  }

  function removerJogador(id) {
    if (!quadra) return;

    const jogador = quadra.jogadores.find((j) => j.id === id);
    const nome = jogador ? jogador.nome : "essa pessoa";

    const ok = confirm(
      `Remover ${nome} da lista? Essa ação não pode ser desfeita.`
    );
    if (!ok) return;

    quadra.jogadores = quadra.jogadores.filter((j) => j.id !== id);
    quadra.conflitos = quadra.conflitos.filter(
      (c) => c.jogadorA_id !== id && c.jogadorB_id !== id
    );

    console.log(
      "[LOG] removerPessoa -> id:",
      id,
      "restantes:",
      quadra.jogadores
    );

    atualizarQuadraInfo();
    renderJogadores();
    atualizarSelectJogadores();
    renderConflitos();
    renderPartidaAtual();
    renderHistorico();
    salvarEstado();
  }

  function adicionarConflito() {
    if (!quadra) {
      alert("Crie uma quadra primeiro.");
      return;
    }
    const idA = Number(selectJogadorA.value);
    const idB = Number(selectJogadorB.value);
    const tipo = selectTipoConflito.value;

    if (!idA || !idB || idA === idB) {
      alert("Selecione duas pessoas diferentes.");
      return;
    }

    const existe = quadra.conflitos.some(
      (c) =>
        ((c.jogadorA_id === idA && c.jogadorB_id === idB) ||
          (c.jogadorA_id === idB && c.jogadorB_id === idA)) &&
        c.tipo === tipo
    );
    if (existe) {
      alert("Esse conflito já existe.");
      return;
    }

    const conflito = {
      id: gerarId(),
      jogadorA_id: idA,
      jogadorB_id: idB,
      tipo,
    };

    quadra.conflitos.push(conflito);
    console.log("[LOG] adicionarConflito ->", conflito);

    renderConflitos();
    salvarEstado();
  }

  function removerConflito(id) {
    if (!quadra) return;
    quadra.conflitos = quadra.conflitos.filter((c) => c.id !== id);
    console.log("[LOG] removerConflito -> id:", id);
    renderConflitos();
    salvarEstado();
  }

  // Regras de conflito (por pessoa, para seleção de partida)

  function naoGeraConflitoMesmaPartida(jogador, listaAtual, conflitos) {
    for (const outro of listaAtual) {
      for (const conf of conflitos) {
        if (conf.tipo !== TipoConflito.NAO_MESMA_PARTIDA) continue;
        const par1 = conf.jogadorA_id === jogador.id && conf.jogadorB_id === outro.id;
        const par2 = conf.jogadorB_id === jogador.id && conf.jogadorA_id === outro.id;
        if (par1 || par2) {
          console.log(
            "[LOG] conflito NAO_MESMA_PARTIDA bloqueou jogador",
            jogador,
            "com",
            outro,
            "->",
            conf
          );
          return false;
        }
      }
    }
    return true;
  }

  function naoGeraConflitoMesmoTime(time, conflitos) {
    for (let i = 0; i < time.length; i++) {
      for (let j = i + 1; j < time.length; j++) {
        const a = time[i];
        const b = time[j];
        for (const conf of conflitos) {
          if (conf.tipo !== TipoConflito.NAO_MESMO_TIME) continue;
          const par1 = conf.jogadorA_id === a.id && conf.jogadorB_id === b.id;
          const par2 = conf.jogadorB_id === a.id && conf.jogadorA_id === b.id;
          if (par1 || par2) {
            console.log(
              "[LOG] conflito NAO_MESMO_TIME bloqueou par",
              a,
              b,
              "->",
              conf
            );
            return false;
          }
        }
      }
    }
    return true;
  }

  // Seleção de pessoas e geração de times

  function selecionarPessoasParaPartida(priorizarMenosJogos) {
    if (!quadra) return null;
    if (quadra.jogadores.length < 6) {
      throw new Error("É preciso ter pelo menos 6 pessoas para gerar uma partida.");
    }

    const pessoas = quadra.jogadores.slice();

    if (priorizarMenosJogos) {
      pessoas.sort((a, b) => a.jogos_jogados - b.jogos_jogados);
      embaralharArray(pessoas);
      console.log(
        "[LOG] selecionarPessoasParaPartida (priorizarMenosJogos=true) -> ordenadas:",
        pessoas
      );
    } else {
      embaralharArray(pessoas);
      console.log(
        "[LOG] selecionarPessoasParaPartida (priorizarMenosJogos=false) -> embaralhadas:",
        pessoas
      );
    }

    const selecionados = [];

    for (const pessoa of pessoas) {
      if (selecionados.length === 6) break;
      if (
        naoGeraConflitoMesmaPartida(pessoa, selecionados, quadra.conflitos)
      ) {
        selecionados.push(pessoa);
      }
    }

    if (selecionados.length < 6) {
      console.log(
        "[LOG][ERRO] selecionarPessoasParaPartida -> não conseguiu 6 pessoas",
        selecionados
      );
      throw new Error(
        "Não foi possível montar 6 pessoas respeitando os conflitos de 'não mesma partida'."
      );
    }

    console.log("[LOG] selecionarPessoasParaPartida -> selecionadas:", selecionados);
    return selecionados;
  }

  function gerarTimes(pessoasSelecionadas, conflitos) {
    if (pessoasSelecionadas.length !== 6) {
      throw new Error("É necessário exatamente 6 pessoas.");
    }

    const indices = [0, 1, 2, 3, 4, 5];
    const combinacoes = combinacoesDe(indices, 3);

    for (const combo of combinacoes) {
      const timeA = combo.map((i) => pessoasSelecionadas[i]);
      const restoIndices = indices.filter((i) => !combo.includes(i));
      const timeB = restoIndices.map((i) => pessoasSelecionadas[i]);

      if (
        naoGeraConflitoMesmoTime(timeA, conflitos) &&
        naoGeraConflitoMesmoTime(timeB, conflitos)
      ) {
        console.log("[LOG] gerarTimes -> timeA:", timeA, "timeB:", timeB);
        return { timeA, timeB };
      }
    }

    console.log(
      "[LOG][ERRO] gerarTimes -> nenhuma combinação válida para conflitos:",
      conflitos
    );
    throw new Error(
      "Não foi possível montar times respeitando os conflitos de 'não mesmo time'."
    );
  }

  function criarProximaPartida() {
    if (!quadra) {
      throw new Error("Crie uma quadra primeiro.");
    }

    const priorizar = chkPriorizarMenosJogos.checked;
    console.log("[LOG] criarProximaPartida -> priorizarMenosJogos:", priorizar);

    const pessoasSelecionadas = selecionarPessoasParaPartida(priorizar);
    const { timeA, timeB } = gerarTimes(pessoasSelecionadas, quadra.conflitos);

    const partida = {
      id: quadra.proxima_partida_id++,
      timeA,
      timeB,
      status: "agendada",
      golsTimeA: null,
      golsTimeB: null,
    };

    quadra.partidas.push(partida);
    partidaAtualId = partida.id;

    console.log("[LOG] criarProximaPartida -> partida criada:", partida);

    return partida;
  }

  function finalizarPartidaAtual() {
    if (!quadra || partidaAtualId == null) {
      console.log("[LOG] finalizarPartidaAtual -> sem partida atual");
      return;
    }

    const partida = quadra.partidas.find((p) => p.id === partidaAtualId);
    if (!partida) {
      console.log("[LOG][ERRO] finalizarPartidaAtual -> partida não encontrada", partidaAtualId);
      return;
    }
    if (partida.status === "finalizada") {
      console.log("[LOG] finalizarPartidaAtual -> partida já finalizada", partida.id);
      return;
    }

    const ok = confirm(
      "Finalizar partida e registrar placar e jogos jogados para cada pessoa?"
    );
    if (!ok) return;

    const golsA = Number(placarTimeAInput.value || 0);
    const golsB = Number(placarTimeBInput.value || 0);

    partida.golsTimeA = Number.isNaN(golsA) ? 0 : golsA;
    partida.golsTimeB = Number.isNaN(golsB) ? 0 : golsB;

    const todos = [...partida.timeA, ...partida.timeB];

    todos.forEach((jogadorPartida) => {
      const original = quadra.jogadores.find((j) => j.id === jogadorPartida.id);
      if (original) {
        original.jogos_jogados += 1;
      }
    });

    partida.status = "finalizada";
    partidaAtualId = null;

    console.log("[LOG] finalizarPartidaAtual -> partida finalizada:", partida);
    console.log("[LOG] finalizarPartidaAtual -> pessoas atualizadas:", quadra.jogadores);
  }

  // helpers de arrays

  function embaralharArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function combinacoesDe(arr, k) {
    const resultado = [];
    function backtrack(inicio, combo) {
      if (combo.length === k) {
        resultado.push(combo.slice());
        return;
      }
      for (let i = inicio; i < arr.length; i++) {
        combo.push(arr[i]);
        backtrack(i + 1, combo);
        combo.pop();
      }
    }
    backtrack(0, []);
    return resultado;
  }

  // Handlers

  btnCriarQuadra.addEventListener("click", () => {
    criarOuResetarQuadra();
  });

  formJogador.addEventListener("submit", (ev) => {
    ev.preventDefault();
    adicionarJogador();
  });

  btnAdicionarJogador.addEventListener("click", (ev) => {
    ev.preventDefault();
    adicionarJogador();
  });

  btnAdicionarConflito.addEventListener("click", () => {
    adicionarConflito();
  });

  btnGerarPartida.addEventListener("click", () => {
    erroPartida.textContent = "";
    try {
      criarProximaPartida();
      atualizarQuadraInfo();
      renderPartidaAtual();
      renderHistorico();
      salvarEstado();
    } catch (e) {
      console.error(e);
      erroPartida.textContent = e.message;
    }
  });

  btnFinalizarPartida.addEventListener("click", () => {
    finalizarPartidaAtual();
    atualizarQuadraInfo();
    renderJogadores();
    renderPartidaAtual();
    renderHistorico();
    salvarEstado();
  });

  // Carrega estado salvo, se existir
  carregarEstado();

  if (!quadra) {
    atualizarQuadraInfo();
  } else {
    atualizarQuadraInfo();
    renderJogadores();
    atualizarSelectJogadores();
    renderConflitos();
    renderPartidaAtual();
    renderHistorico();
  }
});
