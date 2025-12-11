// app.js

// ===============================
// Estado global simples
// ===============================
const API_URL =
  "https://script.google.com/macros/s/AKfycbwR2cGmI9k2Ljr1Du9I_NEvakioJwSBDcY4XAqFyjQYK4TBKqwJiK5gcAFziiZh9g/exec";

let quadra = null;
let nextGlobalId = 1;
let partidaAtualId = null;

// id da sessão/quadra atual (usado para falar com o Sheets)
let currentQuadraId = null;
const ID_STORAGE_KEY = "polo_id_quadra_atual_v1";


// Tipos de conflito
const TipoConflito = {
  NAO_MESMO_TIME: "NAO_MESMO_TIME",
  NAO_MESMA_PARTIDA: "NAO_MESMA_PARTIDA",
};

// ===============================
// Utilidades básicas
// ===============================

function gerarIdQuadra(nome) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate() + 0).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  const slug =
    (nome || "quadra")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // tira acentos
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "quadra";

  return `${y}${m}${d}_${h}${min}_${slug}`;
}


function gerarId() {
  const id = nextGlobalId++;
  console.log("[LOG] gerarId ->", id);
  return id;
}

async function salvarEstado() {
  if (!quadra) return;

  // se por algum motivo ainda não tiver id de quadra, gera um agora
  if (!currentQuadraId) {
    currentQuadraId = gerarIdQuadra(quadra.nome || "Quadra");
    localStorage.setItem(ID_STORAGE_KEY, currentQuadraId);
  }

  const estado = {
    quadra,
    nextGlobalId,
    partidaAtualId,
  };

  const body = new URLSearchParams();
  body.append("id_quadra", currentQuadraId);
  body.append("estado_json", JSON.stringify(estado));

  console.log("[LOG] salvando no servidor (form-urlencoded)...", {
    id_quadra: currentQuadraId,
    estado,
  });

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body,
    });

    const texto = await res.text();
    console.log("[LOG] resposta da API:", texto);
  } catch (err) {
    console.error("[LOG] erro ao salvar no servidor:", err);
  }
}


async function carregarEstado() {
  if (!currentQuadraId) {
    console.log(
      "[LOG] carregarEstado -> sem id de quadra local, nada para buscar no servidor"
    );
    return;
  }

  try {
    const res = await fetch(
      API_URL + "?id=" + encodeURIComponent(currentQuadraId)
    );
    const data = await res.json();

    console.log("[LOG] carregarEstado -> recebido da API:", data);

    if (!data || !data.quadra) {
      console.log("[LOG] nenhuma quadra salva ainda para este id");
      return;
    }

    quadra = data.quadra;
    nextGlobalId = data.nextGlobalId || 1;
    partidaAtualId = data.partidaAtualId || null;
  } catch (e) {
    console.error("[LOG][ERRO] carregarEstado:", e);
  }
}




// Helpers de arrays
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

// ===============================
// Regras de conflito
// ===============================
function naoGeraConflitoMesmaPartida(jogador, listaAtual, conflitos) {
  for (const outro of listaAtual) {
    for (const conf of conflitos) {
      if (conf.tipo !== TipoConflito.NAO_MESMA_PARTIDA) continue;
      const par1 =
        conf.jogadorA_id === jogador.id && conf.jogadorB_id === outro.id;
      const par2 =
        conf.jogadorB_id === jogador.id && conf.jogadorA_id === outro.id;
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

// ===============================
// DOM + Lógica principal
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[LOG] DOMContentLoaded - inicializando app Bike Polo");
    // tenta recuperar o id da última quadra usada neste dispositivo
  currentQuadraId = localStorage.getItem(ID_STORAGE_KEY);
  console.log("[LOG] id de quadra carregado do localStorage:", currentQuadraId);


  // ----- Elementos da UI -----
  const quadraNomeInput = document.getElementById("quadraNome");
  const btnCriarQuadra = document.getElementById("btnCriarQuadra");
  const quadraInfo = document.getElementById("quadraInfo");

  const formJogador = document.getElementById("formJogador");
  const jogadorNomeInput = document.getElementById("jogadorNome");
  const tabelaJogadoresBody = document.querySelector("#tabelaJogadores tbody");

  const quickButtons = document.querySelectorAll(".quick-player-button");

  const selectJogadorA = document.getElementById("selectJogadorA");
  const selectJogadorB = document.getElementById("selectJogadorB");
  const selectTipoConflito = document.getElementById("selectTipoConflito");
  const btnAdicionarConflito = document.getElementById("btnAdicionarConflito");
  const listaConflitos = document.getElementById("listaConflitos");

  const chkPriorizarMenosJogos = document.getElementById(
    "chkPriorizarMenosJogos"
  );
  const btnGerarPartida = document.getElementById("btnGerarPartida");
  const erroPartida = document.getElementById("erroPartida");

  const partidaConteudo = document.getElementById("partidaConteudo");
  const placarTimeAInput = document.getElementById("placarTimeA");
  const placarTimeBInput = document.getElementById("placarTimeB");
  const btnFinalizarPartida = document.getElementById("btnFinalizarPartida");

  const tabelaHistoricoBody = document.querySelector("#tabelaHistorico tbody");

  // ----- Abas -----
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabSections = document.querySelectorAll("[data-tab]");

  function setActiveTab(name) {
    console.log("[LOG] setActiveTab ->", name);
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tabName === name);
    });

    tabSections.forEach((sec) => {
      const secTab = sec.dataset.tab;
      sec.classList.toggle("hidden", secTab !== name);
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tabName;
      setActiveTab(target);
    });
  });

  // ===============================
  // Funções de renderização
  // ===============================
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

  function atualizarQuickButtons() {
    if (!quickButtons) return;

    if (!quadra) {
      quickButtons.forEach((btn) => btn.classList.remove("active"));
      return;
    }

    quickButtons.forEach((btn) => {
      const nome = btn.dataset.nome;
      const existe = quadra.jogadores.some(
        (j) => j.nome.toLowerCase() === nome.toLowerCase()
      );
      btn.classList.toggle("active", !!existe);
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

    // Sincroniza estado visual dos botões rápidos
    atualizarQuickButtons();
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

    placarTimeAInput.disabled = partida.status === "finalizada";
    placarTimeBInput.disabled = partida.status === "finalizada";

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

  // ===============================
  // Lógica principal
  // ===============================
function criarOuResetarQuadra() {
  const nome = quadraNomeInput.value.trim() || "Quadra sem nome";

  // gera um novo id de sessão baseado em data/hora + nome
  currentQuadraId = gerarIdQuadra(nome);
  localStorage.setItem(ID_STORAGE_KEY, currentQuadraId);

  // reinicia contador de IDs internos (pessoas, conflitos, etc.)
  nextGlobalId = 1;
  partidaAtualId = null;

  quadra = {
    id: currentQuadraId,
    nome,
    jogadores: [],
    conflitos: [],
    partidas: [],
    proxima_partida_id: 1,
  };

  console.log("[LOG] criarOuResetarQuadra ->", quadra, "id:", currentQuadraId);

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
      chegouEm: Date.now(),
      primeiroJogoPendente: true,
    };
    quadra.jogadores.push(jogador);
    jogadorNomeInput.value = "";

    atualizarQuadraInfo();
    renderJogadores();
    atualizarSelectJogadores();
    renderConflitos();
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

  function toggleJogadorRapido(nome) {
    if (!quadra) {
      alert("Crie uma quadra primeiro.");
      return;
    }

    const existente = quadra.jogadores.find(
      (j) => j.nome.toLowerCase() === nome.toLowerCase()
    );

    if (existente) {
      const ok = confirm(`Remover ${nome} da lista de hoje?`);
      if (!ok) return;

      quadra.jogadores = quadra.jogadores.filter(
        (j) => j.id !== existente.id
      );
      quadra.conflitos = quadra.conflitos.filter(
        (c) =>
          c.jogadorA_id !== existente.id && c.jogadorB_id !== existente.id
      );
    } else {
      const jogador = {
        id: gerarId(),
        nome,
        jogos_jogados: 0,
        chegouEm: Date.now(),
        primeiroJogoPendente: true,
      };
      quadra.jogadores.push(jogador);
    }

    atualizarQuadraInfo();
    renderJogadores();
    atualizarSelectJogadores();
    renderConflitos();
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

  // Seleção de pessoas e geração de times
  function selecionarPessoasParaPartida(priorizarMenosJogos) {
  if (!quadra) return null;
  if (quadra.jogadores.length < 6) {
    throw new Error("É preciso ter pelo menos 6 pessoas para gerar uma partida.");
  }

  const jogadores = quadra.jogadores.slice();

  // embaralha tudo uma vez só, pra ter desempate aleatório
  embaralharArray(jogadores);

  const recemChegades = jogadores.filter((p) => p.primeiroJogoPendente);
  const veteranas = jogadores.filter((p) => !p.primeiroJogoPendente);

  let candidatos = [];

  if (priorizarMenosJogos) {
    // 1) recém-chegades sempre têm prioridade absoluta
    // (normalmente todo mundo começa assim, quem ainda não jogou fica aqui)
    // 2) veteranas entram em ordem de quem jogou menos

    veteranas.sort((a, b) => a.jogos_jogados - b.jogos_jogados);

    // garante que ninguém com MUITO mais jogo furar a fila:
    // só consideramos veteranas com até +1 jogo acima do mínimo
    const minJogos =
      veteranas.length > 0 ? veteranas[0].jogos_jogados : 0;
    const limite = minJogos + 1;
    const veteranasEquilibradas = veteranas.filter(
      (p) => p.jogos_jogados <= limite
    );

    candidatos = [...recemChegades, ...veteranasEquilibradas];
  } else {
    // modo "aleatório": recém-chegades primeiro, resto na bagunça
    candidatos = [...recemChegades, ...veteranas];
  }

  const selecionados = [];

  for (const jogador of candidatos) {
    if (selecionados.length === 6) break;

    if (
      naoGeraConflitoMesmaPartida(jogador, selecionados, quadra.conflitos)
    ) {
      selecionados.push(jogador);
    }
  }

  if (selecionados.length < 6) {
    throw new Error(
      "Não foi possível montar 6 pessoas respeitando os conflitos de 'não mesma partida'."
    );
  }

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
      console.log(
        "[LOG][ERRO] finalizarPartidaAtual -> partida não encontrada",
        partidaAtualId
      );
      return;
    }
    if (partida.status === "finalizada") {
      console.log(
        "[LOG] finalizarPartidaAtual -> partida já finalizada",
        partida.id
      );
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
      const original = quadra.jogadores.find(
        (j) => j.id === jogadorPartida.id
      );
      if (original) {
        original.jogos_jogados += 1;
        if (original.primeiroJogoPendente) {
          original.primeiroJogoPendente = false;
        }
      }
    });

    partida.status = "finalizada";
    partidaAtualId = null;

    console.log("[LOG] finalizarPartidaAtual -> partida finalizada:", partida);
    console.log(
      "[LOG] finalizarPartidaAtual -> pessoas atualizadas:",
      quadra.jogadores
    );

    salvarEstado();
  }

  // ===============================
  // Eventos de UI
  // ===============================
  btnCriarQuadra.addEventListener("click", () => {
    criarOuResetarQuadra();
  });

  formJogador.addEventListener("submit", (ev) => {
    ev.preventDefault();
    adicionarJogador();
  });

  const btnAdicionarJogador = document.getElementById("btnAdicionarJogador");
  if (btnAdicionarJogador) {
    btnAdicionarJogador.addEventListener("click", (ev) => {
      ev.preventDefault();
      adicionarJogador();
    });
  }

  if (quickButtons) {
    quickButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const nome = btn.dataset.nome;
        toggleJogadorRapido(nome);
      });
    });
  }

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
  });

  // ===============================
  // Inicialização de estado + aba
  // ===============================
  await carregarEstado();

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

  setActiveTab("setup");
});
