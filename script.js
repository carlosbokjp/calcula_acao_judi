// Configuração
let arquivosData = []; // Array para armazenar dados de todos os arquivos
let eventosSelecionados = []; // Array para armazenar múltiplos eventos
let indicesData = []; // Array para armazenar os índices do CSV
let indicesMap = new Map(); // Mapa para lookup rápido de índices por mês/ano

// Variáveis de controle de correção
let modoCorrecao = 'nenhum'; // 'csv', 'padrao', ou 'nenhum'
let indicePadraoCorrecao = 1.060902; // Valor padrão

// Variáveis de controle de reajuste manual
let modoReajusteAtual = 'automatico'; // 'automatico' ou 'manual'
let percentualReajusteManual = 0; // Percentual de reajuste manual para o primeiro mês

// Vencimento anterior informado pelo usuário
let vencimentoBaseAnterior = 0; // Valor do vencimento anterior ao primeiro mês

// NOVA VARIÁVEL: Valores devidos iniciais para cada evento
let valoresDevidosIniciais = {}; // { "348": 550.00, "621": 120.00 }

// Elementos DOM
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const clearFile = document.getElementById('clearFile');
const processFile = document.getElementById('processFile');
const buscarEventos = document.getElementById('buscarEventos');
const adicionarEvento = document.getElementById('adicionarEvento');
const loading = document.getElementById('loading');
const messages = document.getElementById('messages');
const results = document.getElementById('results');
const tableBody = document.getElementById('tableBody');
const totalMeses = document.getElementById('totalMeses');
const periodoMeses = document.getElementById('periodoMeses');
const totalEventos = document.getElementById('totalEventos');
const totalGSHUPago = document.getElementById('totalGSHUPago');
const totalDiferencas = document.getElementById('totalDiferencas');
const selecionarEvento = document.getElementById('selecionarEvento');
const codigoEventoBusca = document.getElementById('codigoEventoBusca');
const arquivosSelecionados = document.getElementById('arquivosSelecionados');
const listaArquivos = document.getElementById('listaArquivos');
const eventosSelecionadosDiv = document.getElementById('eventosSelecionados');
const listaEventos = document.getElementById('listaEventos');
const eventosPlaceholder = document.getElementById('eventosPlaceholder');

// Elementos da área de upload de índices
const uploadIndicesArea = document.getElementById('uploadIndicesArea');
const fileIndicesInput = document.getElementById('fileIndicesInput');
const fileIndicesInfo = document.getElementById('fileIndicesInfo');
const fileIndicesName = document.getElementById('fileIndicesName');
const clearIndicesFile = document.getElementById('clearIndicesFile');
const aplicarCorrecaoBtn = document.getElementById('aplicarCorrecaoBtn');
const indicesStatus = document.getElementById('indicesStatus');
const exportarCorrigidoBtn = document.getElementById('exportarCorrigidoBtn');
const cardTotalCorrigido = document.getElementById('cardTotalCorrigido');
const totalCorrigidoElement = document.getElementById('totalCorrigido');
const indicePadraoInput = document.getElementById('indicePadrao');

// Elementos de reajuste manual
const modoReajusteSelect = document.getElementById('modoReajuste');
const grupoReajusteManual = document.getElementById('grupoReajusteManual');
const percentualReajusteInput = document.getElementById('percentualReajuste');
const primeiroMesReajusteInfo = document.getElementById('primeiroMesReajusteInfo');

// Elementos de valores iniciais
const valoresIniciaisSection = document.getElementById('valoresIniciaisSection');
const valoresIniciaisContainer = document.getElementById('valoresIniciaisContainer');

// Vencimento anterior
const vencimentoAnteriorInput = document.getElementById('vencimentoAnterior');

// Estado global para cada evento (persiste entre execuções)
let estadoEventos = {};

// Variáveis globais de controle
let vencimentoAnterior = 0;
let ultimoMesProcessado = '';
let ultimoAnoProcessado = 0;

// Acumuladores para o resumo final
let totalGeralDiferenca = 0;
let totalGeral13o = 0;
let totalGeralFerias = 0;
let totalGeralTerco = 0;
let totalGeralDaAcao = 0;
let totalGeralCorrigido = 0;
let dataReferenciaInicial = null;
let dataReferenciaFinal = null;

// Resultados consolidados
let todosResultados = [];
let todasLinhasDetalhadas = [];

// Função para extrair apenas o número do evento
function extrairNumeroEvento(texto) {
    if (!texto) return '';
    const match = String(texto).match(/^(\d+)/);
    return match ? match[1] : '';
}

// EVENT LISTENERS PARA REAJUSTE MANUAL
if (modoReajusteSelect) {
    modoReajusteSelect.addEventListener('change', function() {
        modoReajusteAtual = this.value;
        
        if (modoReajusteAtual === 'manual') {
            grupoReajusteManual.style.display = 'block';
            atualizarInfoPrimeiroMes();
        } else {
            grupoReajusteManual.style.display = 'none';
            percentualReajusteManual = 0;
        }
    });
}

if (percentualReajusteInput) {
    percentualReajusteInput.addEventListener('input', function() {
        percentualReajusteManual = parseFloat(this.value) || 0;
        atualizarInfoPrimeiroMes();
    });
}

// Função para atualizar informações sobre o primeiro mês
function atualizarInfoPrimeiroMes() {
    if (!primeiroMesReajusteInfo) return;
    
    if (dataReferenciaInicial && percentualReajusteManual > 0) {
        const [ano, mes] = dataReferenciaInicial.split('-');
        const nomeMes = converterNumeroParaMes(parseInt(mes));
        primeiroMesReajusteInfo.innerHTML = `
            <small style="color: #2196F3;">
                ⚡ Reajuste manual de ${percentualReajusteManual}% será aplicado em ${nomeMes}/${ano}
            </small>
        `;
    } else if (percentualReajusteManual > 0) {
        primeiroMesReajusteInfo.innerHTML = `
            <small style="color: #FF9800;">
                ⚠️ Selecione uma data referência inicial para aplicar o reajuste manual
            </small>
        `;
    } else {
        primeiroMesReajusteInfo.innerHTML = '';
    }
}

// Função para calcular o fator de reajuste baseado no modo selecionado
function calcularFatorReajuste(vencimentoAtual, vencimentoAnterior, mesNumero, anoArquivo, mesNome, ehPrimeiroMesDoFiltro) {
    let fator = 1.0;
    
    // PRIORIDADE 1: Reajuste manual (se configurado e for o primeiro mês)
    if (modoReajusteAtual === 'manual' && percentualReajusteManual > 0 && ehPrimeiroMesDoFiltro) {
        fator = 1 + (percentualReajusteManual / 100);
        console.log(`📊 REAJUSTE MANUAL: ${percentualReajusteManual}% aplicado em ${mesNome}/${anoArquivo} (fator: ${fator.toFixed(6)})`);
        return fator;
    }
    
    // PRIORIDADE 2: Reajuste automático baseado na variação do vencimento
    if (vencimentoAnterior > 0 && vencimentoAtual > 0 && vencimentoAtual !== vencimentoAnterior) {
        fator = vencimentoAtual / vencimentoAnterior;
        
        // Mostra informação detalhada no console
        if (ehPrimeiroMesDoFiltro) {
            console.log(`📊 PRIMEIRO REAJUSTE: Vencimento anterior (R$ ${vencimentoAnterior.toFixed(2)}) → Atual (R$ ${vencimentoAtual.toFixed(2)}) = ${((fator - 1) * 100).toFixed(2)}%`);
        } else {
            console.log(`📊 REAJUSTE AUTOMÁTICO: ${((fator - 1) * 100).toFixed(2)}% em ${mesNome}/${anoArquivo}`);
        }
    } else if (vencimentoAnterior === 0 && vencimentoAtual > 0 && ehPrimeiroMesDoFiltro) {
        console.log(`⚠️ Primeiro mês sem vencimento anterior. Usando fator 1.0 (sem reajuste inicial)`);
    }
    
    return fator;
}

// Event Listeners originais
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFiles(files);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
});

buscarEventos.addEventListener('click', () => {
    if (arquivosData.length === 0) {
        showMessage('Carregue os arquivos CSV primeiro.', 'warning');
        return;
    }
    
    const primeiroArquivo = arquivosData[0];
    if (!primeiroArquivo) return;
    
    const codigoBusca = codigoEventoBusca.value.trim();
    if (!codigoBusca) {
        showMessage('Digite um código de evento para buscar.', 'warning');
        return;
    }
    
    selecionarEvento.style.display = 'block';
    selecionarEvento.innerHTML = '<option value="">Selecione um evento</option>';
    
    const eventosEncontrados = primeiroArquivo.eventos.filter(e => 
        e.numeroEvento.startsWith(codigoBusca)
    );
    
    if (eventosEncontrados.length === 0) {
        showMessage(`Nenhum evento encontrado com o código ${codigoBusca}`, 'warning');
        selecionarEvento.style.display = 'none';
        return;
    }
    
    const eventosUnicos = [];
    const numerosVistos = new Set();
    eventosEncontrados.forEach(evento => {
        if (!numerosVistos.has(evento.numeroEvento)) {
            numerosVistos.add(evento.numeroEvento);
            eventosUnicos.push(evento);
        }
    });
    
    eventosUnicos.forEach(evento => {
        const option = document.createElement('option');
        option.value = evento.numeroEvento;
        option.textContent = `${evento.numeroEvento} - ${evento.descricao}`;
        selecionarEvento.appendChild(option);
    });
    
    showMessage(`${eventosUnicos.length} evento(s) encontrado(s)`, 'success');
});

adicionarEvento.addEventListener('click', () => {
    const codigoBusca = codigoEventoBusca.value.trim();
    const eventoSelect = selecionarEvento;
    
    if (eventoSelect.style.display !== 'none' && eventoSelect.value) {
        adicionarEventoDaLista(eventoSelect.value, eventoSelect.selectedOptions[0].text);
    } 
    else if (codigoBusca) {
        adicionarEventoPorCodigo(codigoBusca);
    } else {
        showMessage('Digite um código ou selecione um evento da lista.', 'warning');
    }
});

function adicionarEventoPorCodigo(codigo) {
    if (!arquivosData.length) {
        showMessage('Carregue os arquivos primeiro.', 'warning');
        return;
    }
    
    const numeroCodigo = extrairNumeroEvento(codigo);
    if (!numeroCodigo) {
        showMessage('Código de evento inválido.', 'error');
        return;
    }
    
    const eventoExiste = arquivosData.some(arquivo => 
        arquivo.eventos.some(e => e.numeroEvento === numeroCodigo)
    );
    
    if (!eventoExiste) {
        showMessage(`Evento ${numeroCodigo} não encontrado em nenhum arquivo.`, 'error');
        return;
    }
    
    let descricao = numeroCodigo;
    for (let arquivo of arquivosData) {
        const evento = arquivo.eventos.find(e => e.numeroEvento === numeroCodigo);
        if (evento) {
            descricao = evento.descricao;
            break;
        }
    }
    
    if (eventosSelecionados.some(e => e.codigo === numeroCodigo)) {
        showMessage(`Evento ${numeroCodigo} já foi adicionado.`, 'warning');
        return;
    }
    
    eventosSelecionados.push({
        codigo: numeroCodigo,
        descricao: descricao
    });
    
    atualizarListaEventos();
    codigoEventoBusca.value = '';
    selecionarEvento.style.display = 'none';
}

function adicionarEventoDaLista(codigo, texto) {
    const numeroCodigo = extrairNumeroEvento(codigo);
    
    if (eventosSelecionados.some(e => e.codigo === numeroCodigo)) {
        showMessage(`Evento ${numeroCodigo} já foi adicionado.`, 'warning');
        return;
    }
    
    const eventoExiste = arquivosData.some(arquivo => 
        arquivo.eventos.some(e => e.numeroEvento === numeroCodigo)
    );
    
    if (!eventoExiste) {
        showMessage(`Evento ${numeroCodigo} não encontrado em nenhum arquivo.`, 'error');
        return;
    }
    
    const descricao = texto.split(' - ')[1] || texto;
    
    eventosSelecionados.push({
        codigo: numeroCodigo,
        descricao: descricao
    });
    
    atualizarListaEventos();
    selecionarEvento.value = '';
    codigoEventoBusca.value = '';
    selecionarEvento.style.display = 'none';
}

// NOVA FUNÇÃO: Gerar campos para valores iniciais
function gerarCamposValoresIniciais() {
    if (!valoresIniciaisContainer || eventosSelecionados.length === 0) {
        if (valoresIniciaisSection) valoresIniciaisSection.style.display = 'none';
        return;
    }
    
    valoresIniciaisSection.style.display = 'block';
    let html = '';
    
    eventosSelecionados.forEach(evento => {
        const sigla = evento.codigo === '348' ? 'GSHU' : 
                      evento.codigo === '621' ? 'Adc. Noturno' : 
                      `Evento ${evento.codigo}`;
        
        const valorAtual = valoresDevidosIniciais[evento.codigo] || '';
        
        html += `
            <div class="config-item">
                <label>${sigla}</label>
                <input type="number" 
                       id="valorInicial_${evento.codigo}" 
                       class="form-control valor-inicial"
                       data-codigo="${evento.codigo}"
                       step="0.01" 
                       min="0"
                       value="${valorAtual}"
                       placeholder="R$ 0,00">
                <small style="color: #666;">Valor devido antes do período</small>
            </div>
        `;
    });
    
    valoresIniciaisContainer.innerHTML = html;
    
    // Adiciona event listeners para salvar os valores quando alterados
    document.querySelectorAll('.valor-inicial').forEach(input => {
        input.addEventListener('change', function() {
            const codigo = this.dataset.codigo;
            const valor = parseFloat(this.value) || 0;
            valoresDevidosIniciais[codigo] = valor;
            console.log(`💰 Valor inicial para evento ${codigo}: R$ ${valor.toFixed(2)}`);
        });
    });
}

function atualizarListaEventos() {
    if (eventosSelecionados.length === 0) {
        eventosPlaceholder.style.display = 'block';
        listaEventos.style.display = 'none';
        if (valoresIniciaisSection) valoresIniciaisSection.style.display = 'none';
        return;
    }
    
    eventosPlaceholder.style.display = 'none';
    listaEventos.style.display = 'block';
    
    let html = '';
    eventosSelecionados.forEach((evento) => {
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px; margin: 5px 0; background-color: #e8f0fe; border-radius: 5px;">
                <span style="font-weight: 600;">${evento.codigo}</span>
                <span style="flex: 1; margin-left: 10px;">${evento.descricao}</span>
                <button class="btn-remover-evento" data-codigo="${evento.codigo}" style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 16px;" title="Remover evento">✕</button>
            </div>
        `;
    });
    
    listaEventos.innerHTML = html;
    
    // Gerar campos de valores iniciais
    gerarCamposValoresIniciais();
    
    document.querySelectorAll('.btn-remover-evento').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const codigo = e.target.dataset.codigo;
            removerEvento(codigo);
        });
    });
}

function removerEvento(codigo) {
    eventosSelecionados = eventosSelecionados.filter(e => e.codigo !== codigo);
    
    // Remove também dos valores iniciais
    delete valoresDevidosIniciais[codigo];
    
    atualizarListaEventos();
}

clearFile.addEventListener('click', () => {
    fileInput.value = '';
    fileInfo.style.display = 'none';
    arquivosSelecionados.style.display = 'none';
    results.style.display = 'none';
    arquivosData = [];
    todosResultados = [];
    todasLinhasDetalhadas = [];
    eventosSelecionados = [];
    estadoEventos = {};
    valoresDevidosIniciais = {};
    atualizarListaEventos();
    clearMessages();
    
    if (codigoEventoBusca) codigoEventoBusca.value = '';
    
    vencimentoAnterior = 0;
    vencimentoBaseAnterior = 0;
    ultimoMesProcessado = '';
    ultimoAnoProcessado = 0;
    totalGeralDiferenca = 0;
    totalGeral13o = 0;
    totalGeralFerias = 0;
    totalGeralTerco = 0;
    totalGeralDaAcao = 0;
    dataReferenciaInicial = null;
    dataReferenciaFinal = null;
    totalGeralCorrigido = 0;
    modoCorrecao = 'nenhum';
    modoReajusteAtual = 'automatico';
    percentualReajusteManual = 0;
    
    if (modoReajusteSelect) modoReajusteSelect.value = 'automatico';
    if (grupoReajusteManual) grupoReajusteManual.style.display = 'none';
    if (percentualReajusteInput) percentualReajusteInput.value = '';
    if (primeiroMesReajusteInfo) primeiroMesReajusteInfo.innerHTML = '';
    if (vencimentoAnteriorInput) vencimentoAnteriorInput.value = '';
    
    selecionarEvento.innerHTML = '<option value="">Selecione um evento</option>';
    selecionarEvento.style.display = 'none';
    listaArquivos.innerHTML = '';
});

processFile.addEventListener('click', () => {
    if (arquivosData.length === 0) {
        showMessage('Nenhum arquivo carregado. Selecione os arquivos CSV primeiro.', 'error');
        return;
    }
    
    if (eventosSelecionados.length === 0) {
        showMessage('Selecione pelo menos um evento para calcular o reajuste.', 'warning');
        return;
    }
    
    // Captura o vencimento anterior informado
    if (vencimentoAnteriorInput && vencimentoAnteriorInput.value) {
        vencimentoBaseAnterior = parseFloat(vencimentoAnteriorInput.value) || 0;
        if (vencimentoBaseAnterior > 0) {
            showMessage(`💰 Vencimento anterior informado: R$ ${vencimentoBaseAnterior.toFixed(2)}`, 'info');
        }
    } else {
        vencimentoBaseAnterior = 0;
        showMessage('⚠️ Nenhum vencimento anterior informado. O primeiro mês não terá base para reajuste.', 'warning');
    }
    
    // Captura os valores iniciais dos eventos
    eventosSelecionados.forEach(evento => {
        const input = document.getElementById(`valorInicial_${evento.codigo}`);
        if (input) {
            const valor = parseFloat(input.value) || 0;
            valoresDevidosIniciais[evento.codigo] = valor;
            if (valor > 0) {
                showMessage(`💰 Valor inicial para evento ${evento.codigo}: R$ ${valor.toFixed(2)}`, 'info');
            }
        }
    });
    
    const dataRefInicialInput = document.getElementById('dataReferencia');
    if (dataRefInicialInput && dataRefInicialInput.value) {
        dataReferenciaInicial = dataRefInicialInput.value;
        showMessage(`📅 Data referência inicial: ${dataReferenciaInicial}`, 'info');
    } else {
        dataReferenciaInicial = null;
    }
    
    const dataRefFinalInput = document.getElementById('dataReferencia2');
    if (dataRefFinalInput && dataRefFinalInput.value) {
        dataReferenciaFinal = dataRefFinalInput.value;
        showMessage(`📅 Data referência final: ${dataReferenciaFinal}`, 'info');
    } else {
        dataReferenciaFinal = null;
    }
    
    // Validação do reajuste manual
    if (modoReajusteAtual === 'manual' && percentualReajusteManual > 0 && !dataReferenciaInicial) {
        if (!confirm('Reajuste manual ativo sem data referência inicial. O reajuste será aplicado no primeiro mês processado. Continuar?')) {
            return;
        }
    }
    
    const codigoVencimento = document.getElementById('codigoVencimento').value;
    const numeroVencimento = extrairNumeroEvento(codigoVencimento);
    
    arquivosData.sort((a, b) => {
        const anoA = extrairAnoDoNome(a.arquivo);
        const anoB = extrairAnoDoNome(b.arquivo);
        return anoA - anoB;
    });
    
    processAllFiles(numeroVencimento, eventosSelecionados);
});

function handleFiles(files) {
    arquivosData = [];
    listaArquivos.innerHTML = '';
    
    const fileArray = Array.from(files).sort((a, b) => a.name.localeCompare(b.name));
    
    let processados = 0;
    
    fileArray.forEach((file) => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showMessage(`Arquivo ${file.name} não é CSV. Ignorado.`, 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvData = e.target.result;
                parseCSV(csvData, file.name);
                
                processados++;
                
                const li = document.createElement('li');
                li.textContent = file.name;
                li.setAttribute('data-arquivo', file.name);
                listaArquivos.appendChild(li);
                
                if (processados === fileArray.length) {
                    fileName.textContent = `${fileArray.length} arquivos selecionados`;
                    fileInfo.style.display = 'flex';
                    arquivosSelecionados.style.display = 'block';
                    
                    arquivosData.sort((a, b) => {
                        const anoA = extrairAnoDoNome(a.arquivo);
                        const anoB = extrairAnoDoNome(b.arquivo);
                        return anoA - anoB;
                    });
                    
                    totalEventos.textContent = arquivosData[0]?.eventos.length || 0;
                    showMessage(`${fileArray.length} arquivos carregados com sucesso!`, 'success');
                    
                    // Atualiza info do primeiro mês
                    atualizarInfoPrimeiroMes();
                }
            } catch (error) {
                showMessage(`Erro ao ler arquivo ${file.name}: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file, 'ISO-8859-1');
    });
}

function parseCSV(csvText, nomeArquivo) {
    const lines = csvText.split('\n').filter(line => line.trim() && !line.includes('Total das Vantagens') && !line.includes('Total dos Descontos') && !line.includes('Total Líquido') && !line.includes('Base Previdência'));
    
    const header = lines[0].split(';').map(h => h.trim());
    
    const mesesEncontrados = [];
    for (let i = 2; i < header.length; i++) {
        const coluna = header[i];
        if (coluna && coluna.length > 0 && !coluna.includes('Total') && !coluna.includes('∫') && !coluna.includes('¤') && !coluna.includes('ş')) {
            mesesEncontrados.push({
                nome: coluna,
                indice: i
            });
        }
    }

    const eventos = [];
    const eventosMap = new Map();
    
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length < 3) continue;

        if (cols[0].includes('Total') || cols[0].includes('BASE')) continue;

        const numeroEvento = extrairNumeroEvento(cols[0]);
        if (!numeroEvento) continue;
        
        const descricao = cols[0].substring(numeroEvento.length).replace(/^[\s\-]+/, '') || numeroEvento;

        if (eventosMap.has(numeroEvento)) {
            const eventoExistente = eventosMap.get(numeroEvento);
            for (let m = 0; m < mesesEncontrados.length; m++) {
                const mes = mesesEncontrados[m];
                const valorStr = cols[mes.indice] || '0';
                const valorLimpo = valorStr.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
                const valor = parseFloat(valorLimpo) || 0;
                eventoExistente.valores[mes.nome] = (eventoExistente.valores[mes.nome] || 0) + valor;
            }
        } else {
            const evento = {
                codigo: numeroEvento,
                numeroEvento: numeroEvento,
                descricao: descricao,
                tipo: cols[1] || 'V',
                valores: {},
                linhaOriginal: cols
            };

            for (let m = 0; m < mesesEncontrados.length; m++) {
                const mes = mesesEncontrados[m];
                const valorStr = cols[mes.indice] || '0';
                const valorLimpo = valorStr.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
                evento.valores[mes.nome] = parseFloat(valorLimpo) || 0;
            }

            eventosMap.set(numeroEvento, evento);
        }
    }

    eventosMap.forEach(evento => {
        eventos.push(evento);
    });

    arquivosData.push({
        meses: mesesEncontrados,
        eventos: eventos,
        arquivo: nomeArquivo.replace('.csv', ''),
        ordem: arquivosData.length
    });
}

function calcularAdicionalNoturno(valorPago, percentualReajuste) {
    return arredondar(valorPago * percentualReajuste, 2);
}

function processAllFiles(codigoVencimento, eventosAlvo) {
    loading.classList.add('active');
    results.style.display = 'none';
    clearMessages();
    
    const codigoAdicionalNoturno = document.getElementById('codigoAdicionalNoturno').value;
    const numeroAdicionalNoturno = extrairNumeroEvento(codigoAdicionalNoturno);
    
    let ultimoPercentualReajuste = 1.0;
    let primeiroMesProcessado = true;
    let primeiroMesEncontrado = null;
    let reajusteManualAplicado = false;
    let primeiroVencimentoEncontrado = 0;
    
    // NOVO: Inicializa estado dos eventos com os valores iniciais informados
    eventosAlvo.forEach(evento => {
        const valorInicial = valoresDevidosIniciais[evento.codigo] || 0;
        
        estadoEventos[evento.codigo] = {
            valorDevido: valorInicial,
            ultimoPago: 0,
            ultimoMes: ''
        };
        
        if (valorInicial > 0) {
            console.log(`💰 Estado inicial para evento ${evento.codigo}: R$ ${valorInicial.toFixed(2)}`);
        }
    });
    
    // Inicializa vencimentoAnterior com o valor base informado pelo usuário
    vencimentoAnterior = vencimentoBaseAnterior;
    
    if (vencimentoBaseAnterior > 0) {
        console.log(`💰 Vencimento BASE informado: R$ ${vencimentoBaseAnterior.toFixed(2)} (será usado como referência para o primeiro mês)`);
    }
    
    ultimoMesProcessado = '';
    ultimoAnoProcessado = 0;
    totalGeralDiferenca = 0;
    totalGeral13o = 0;
    totalGeralFerias = 0;
    totalGeralTerco = 0;
    totalGeralDaAcao = 0;
    todosResultados = [];
    todasLinhasDetalhadas = [];

    let dataInicialAno = null;
    let dataInicialMes = null;
    if (dataReferenciaInicial) {
        const [ano, mes] = dataReferenciaInicial.split('-');
        dataInicialAno = parseInt(ano);
        dataInicialMes = parseInt(mes);
        console.log(`Processando a partir de: ${dataInicialMes}/${dataInicialAno}`);
    }

    let dataFinalAno = null;
    let dataFinalMes = null;
    if (dataReferenciaFinal) {
        const [ano, mes] = dataReferenciaFinal.split('-');
        dataFinalAno = parseInt(ano);
        dataFinalMes = parseInt(mes);
        console.log(`Processando até: ${dataFinalMes}/${dataFinalAno}`);
    }

    setTimeout(() => {
        try {
            // NOVO: Filtra apenas os arquivos do período
            const arquivosFiltrados = arquivosData.filter(arquivo => {
                const anoArquivo = extrairAnoDoNome(arquivo.arquivo);
                
                if (dataFinalAno && anoArquivo > dataFinalAno) {
                    return false;
                }
                
                if (dataInicialAno && anoArquivo < dataInicialAno) {
                    return false;
                }
                
                return true;
            });
            
            console.log(`📁 Processando ${arquivosFiltrados.length} arquivos do período (de ${arquivosData.length} total)`);
            
            for (let idx = 0; idx < arquivosFiltrados.length; idx++) {
                const arquivo = arquivosFiltrados[idx];
                const anoArquivo = extrairAnoDoNome(arquivo.arquivo);
                
                const eventoVencimento = arquivo.eventos.find(e => e.numeroEvento === codigoVencimento);
                
                if (!eventoVencimento) {
                    showMessage(`Evento de vencimento (código ${codigoVencimento}) não encontrado no arquivo ${arquivo.arquivo}!`, 'error');
                    continue;
                }

                const liItem = Array.from(listaArquivos.children).find(li => li.textContent.includes(arquivo.arquivo));
                if (liItem) {
                    liItem.classList.add('processado');
                    liItem.textContent = `✅ ${arquivo.arquivo}.csv`;
                }

                const resultadosMensais = [];
                
                for (let i = 0; i < arquivo.meses.length; i++) {
                    const mes = arquivo.meses[i];
                    const nomeMes = mes.nome;
                    
                    const mesNumero = extrairNumeroMes(nomeMes);
                    
                    if (mesNumero === 13) {
                        console.log(`✅ Processando 13º salário: ${nomeMes}/${anoArquivo}`);
                    } else {
                        // Filtro de data inicial por mês
                        if (dataInicialAno && dataInicialMes) {
                            if (anoArquivo < dataInicialAno || (anoArquivo === dataInicialAno && mesNumero < dataInicialMes)) {
                                console.log(`❌ Mês ${nomeMes}/${anoArquivo} ignorado - antes da data inicial`);
                                continue;
                            }
                        }
                        
                        // Filtro de data final por mês
                        if (dataFinalAno && dataFinalMes) {
                            if (anoArquivo > dataFinalAno || (anoArquivo === dataFinalAno && mesNumero > dataFinalMes)) {
                                console.log(`❌ Mês ${nomeMes}/${anoArquivo} ignorado - após data final`);
                                continue;
                            }
                        }
                        
                        console.log(`✅ Processando mês: ${nomeMes}/${anoArquivo}`);
                        
                        // Identifica o primeiro mês do filtro
                        if (primeiroMesProcessado) {
                            primeiroMesEncontrado = `${nomeMes}/${anoArquivo}`;
                            primeiroVencimentoEncontrado = eventoVencimento.valores[nomeMes] || 0;
                            console.log(`🎯 PRIMEIRO MÊS DO FILTRO: ${primeiroMesEncontrado} - Vencimento: R$ ${primeiroVencimentoEncontrado.toFixed(2)}`);
                        }
                    }
                    
                    const vencimentoAtual = eventoVencimento.valores[nomeMes] || 0;
                    
                    // Determina se é o primeiro mês do filtro (apenas para meses normais, não 13º)
                    const ehPrimeiroMes = primeiroMesProcessado && mesNumero !== 13;
                    
                    // CALCULA O FATOR DE REAJUSTE
                    let fator = calcularFatorReajuste(
                        vencimentoAtual, 
                        vencimentoAnterior, 
                        mesNumero, 
                        anoArquivo, 
                        nomeMes,
                        ehPrimeiroMes
                    );
                    
                    // Verifica se foi aplicado reajuste manual
                    if (modoReajusteAtual === 'manual' && fator !== 1.0 && ehPrimeiroMes && !reajusteManualAplicado) {
                        reajusteManualAplicado = true;
                        showMessage(`🎯 Reajuste manual de ${percentualReajusteManual}% aplicado em ${nomeMes}/${anoArquivo}`, 'success');
                    }
                    
                    if (fator !== 1.0) {
                        ultimoPercentualReajuste = fator;
                    }
                    
                    const valoresEventos = {};
                    let totalPagoMes = 0;
                    let totalDevidoMes = 0;
                    
                    for (let eIdx = 0; eIdx < eventosAlvo.length; eIdx++) {
                        const eventoAlvoInfo = eventosAlvo[eIdx];
                        
                        const eventoAlvo = arquivo.eventos.find(e => 
                            e.numeroEvento === eventoAlvoInfo.codigo
                        );
                        
                        let valorPago = 0;
                        if (eventoAlvo) {
                            valorPago = eventoAlvo.valores[nomeMes] || 0;
                        }
                        
                        let estado = estadoEventos[eventoAlvoInfo.codigo];
                        
                        if (eventoAlvoInfo.codigo === numeroAdicionalNoturno) {
                            // Regra especial para adicional noturno
                            if (valorPago > 0) {
                                estado.valorDevido = calcularAdicionalNoturno(valorPago, ultimoPercentualReajuste);
                            } else {
                                estado.valorDevido = 0;
                            }
                            estado.ultimoPago = valorPago;
                        } 
                        else {
                            // Regra para eventos normais
                            // Se é o primeiro mês e tem valor inicial, mantém o valor inicial
                            if (ehPrimeiroMes && estado.valorDevido > 0) {
                                // Já tem o valor inicial, mantém
                                console.log(`ℹ️ Evento ${eventoAlvoInfo.codigo} - valor inicial: R$ ${estado.valorDevido.toFixed(2)}`);
                            } else if (estado.valorDevido === 0 && valorPago > 0) {
                                estado.valorDevido = valorPago;
                            }
                            
                            // Aplica o reajuste se houver
                            if (fator !== 1.0 && estado.valorDevido > 0) {
                                estado.valorDevido = arredondar(estado.valorDevido * fator, 2);
                            }
                            
                            // Verifica reset (quando valor pago reduz)
                            if (estado.ultimoPago > 0 && valorPago > 0 && valorPago < estado.ultimoPago) {
                                estado.valorDevido = valorPago;
                                showMessage(`🔴 RESET em ${nomeMes}/${anoArquivo} - Evento ${eventoAlvoInfo.codigo}: R$ ${formatarMoeda(estado.ultimoPago)} → R$ ${formatarMoeda(valorPago)}`, 'warning');
                            }
                            
                            estado.ultimoPago = valorPago;
                        }
                        
                        const diferencaEvento = arredondar(estado.valorDevido - valorPago, 2);
                        
                        valoresEventos[eventoAlvoInfo.codigo] = {
                            pago: valorPago,
                            devido: estado.valorDevido,
                            diferenca: diferencaEvento
                        };
                        
                        totalPagoMes += valorPago;
                        totalDevidoMes += estado.valorDevido;
                    }
                    
                    const diferencaTotal = arredondar(totalDevidoMes - totalPagoMes, 2);
                    const baseReflexos = diferencaTotal;
                    
                    const incluir13o = document.getElementById('incluir13o').checked;
                    const incluirFerias = document.getElementById('incluirFerias').checked;
                    
                    let ref13o = 0;
                    let refFerias = 0;
                    let refTerco = 0;
                    
                    if (incluir13o) {
                        ref13o = arredondar(baseReflexos / 12, 2);
                    }
                    
                    if (incluirFerias) {
                        refFerias = arredondar(baseReflexos / 12, 2);
                        refTerco = arredondar(refFerias / 3, 2);
                    }
                    
                    const totalMes = arredondar(baseReflexos + ref13o + refFerias + refTerco, 2);

                    if (mesNumero !== 13) {
                        totalGeralDiferenca += diferencaTotal;
                        
                        if (incluir13o) {
                            totalGeral13o += ref13o;
                        }
                        
                        if (incluirFerias) {
                            totalGeralFerias += refFerias;
                            totalGeralTerco += refTerco;
                        }
                        
                        totalGeralDaAcao += totalMes;
                    }

                    const resultado = {
                        arquivo: arquivo.arquivo,
                        mes: nomeMes,
                        ano: anoArquivo,
                        vencimento: vencimentoAtual,
                        indice: fator,
                        ultimoPercentualReajuste: ultimoPercentualReajuste,
                        valoresEventos: valoresEventos,
                        totalPago: totalPagoMes,
                        totalDevido: totalDevidoMes,
                        diferenca: diferencaTotal,
                        baseReflexos: baseReflexos,
                        ref13o: ref13o,
                        refFerias: refFerias,
                        refTerco: refTerco,
                        totalMensal: totalMes,
                        teveReajuste: fator !== 1.0,
                        reajusteManual: (modoReajusteAtual === 'manual' && fator !== 1.0 && ehPrimeiroMes ? fator : null),
                        vencimentoAnterior: vencimentoAnterior
                    };
                    
                    resultadosMensais.push(resultado);
                    todosResultados.push(resultado);

                    // Atualiza o vencimento anterior para o próximo mês (apenas se não for 13º)
                    if (vencimentoAtual > 0 && mesNumero !== 13) {
                        vencimentoAnterior = vencimentoAtual;
                    }
                    
                    ultimoAnoProcessado = anoArquivo;
                    ultimoMesProcessado = nomeMes;
                    
                    if (ehPrimeiroMes) {
                        primeiroMesProcessado = false;
                    }
                }
            }

            renderResults(todosResultados);
            
            totalMeses.textContent = todosResultados.length;
            const primeiro = todosResultados[0];
            const ultimo = todosResultados[todosResultados.length-1];
            periodoMeses.textContent = `${primeiro?.mes || ''}/${primeiro?.ano || ''} - ${ultimo?.mes || ''}/${ultimo?.ano || ''}`;
            
            const totalPago = todosResultados.reduce((acc, r) => acc + r.totalPago, 0);
            totalGSHUPago.textContent = `R$ ${totalPago.toFixed(2).replace('.', ',')}`;
            totalDiferencas.textContent = `R$ ${totalGeralDaAcao.toFixed(2).replace('.', ',')}`;

            loading.classList.remove('active');
            
            let mensagemFinal = `✅ Processamento concluído! ${arquivosFiltrados.length} arquivos do período, ${eventosSelecionados.length} eventos`;
            
            if (vencimentoBaseAnterior > 0) {
                mensagemFinal += ` | Vencimento base: R$ ${vencimentoBaseAnterior.toFixed(2)}`;
            }
            
            // Mostra quantos valores iniciais foram informados
            const valoresIniciaisCount = Object.keys(valoresDevidosIniciais).filter(k => valoresDevidosIniciais[k] > 0).length;
            if (valoresIniciaisCount > 0) {
                mensagemFinal += ` | ${valoresIniciaisCount} valores iniciais`;
            }
            
            if (reajusteManualAplicado) {
                mensagemFinal += ` | Reajuste manual: ${percentualReajusteManual}%`;
            }
            
            showMessage(mensagemFinal, 'success');
            
            // Mostra resumo do primeiro mês
            if (primeiroMesEncontrado && primeiroVencimentoEncontrado > 0) {
                if (vencimentoBaseAnterior > 0) {
                    const variacao = ((primeiroVencimentoEncontrado / vencimentoBaseAnterior) - 1) * 100;
                    console.log(`📊 RESUMO: ${primeiroMesEncontrado} - Vencimento anterior: R$ ${vencimentoBaseAnterior.toFixed(2)} → Atual: R$ ${primeiroVencimentoEncontrado.toFixed(2)} (variação: ${variacao.toFixed(2)}%)`);
                }
            }
            
        } catch (error) {
            showMessage('❌ Erro ao processar dados: ' + error.message, 'error');
            loading.classList.remove('active');
            console.error(error);
        }
    }, 500);
}

function renderResults(resultados) {
    tableBody.innerHTML = '';
    
    const incluir13o = document.getElementById('incluir13o').checked;
    const incluirFerias = document.getElementById('incluirFerias').checked;
    const temCorrecao = modoCorrecao !== 'nenhum';
    
    const eventos = eventosSelecionados;
    
    let theadHtml = '<tr>';
    theadHtml += '<th>Competência</th>';
    theadHtml += '<th>Vencimento Básico</th>';
    theadHtml += '<th>Índice Reajuste (%)</th>';
    
    eventos.forEach(evento => {
        const sigla = evento.codigo === '348' ? 'GSHU' : 
                      evento.codigo === '621' ? 'NOT' : 
                      evento.codigo;
        theadHtml += `<th>${sigla} Pago</th>`;
        theadHtml += `<th>${sigla} Devido</th>`;
        theadHtml += `<th>Dif ${sigla}</th>`;
    });
    
    theadHtml += '<th>Base reflexos</th>';
    
    if (incluir13o) {
        theadHtml += '<th>Reflexo 13º</th>';
    }
    
    if (incluirFerias) {
        theadHtml += '<th>Reflexo Férias</th>';
        theadHtml += '<th>1/3 Constitucional</th>';
    }
    
    theadHtml += '<th>Total Diferença Mensal</th>';
    
    if (temCorrecao) {
        theadHtml += '<th>Total Corrigido</th>';
    }
    
    theadHtml += '</tr>';
    
    document.querySelector('#resultTable thead').innerHTML = theadHtml;
    
    resultados.forEach(r => {
        const row = document.createElement('tr');
        
        if (r.teveReajuste) {
            row.classList.add('destaque-mes');
            
            // Adiciona tooltip se foi reajuste manual
            if (r.reajusteManual) {
                row.setAttribute('title', `Reajuste manual de ${((r.reajusteManual - 1) * 100).toFixed(2)}%`);
            } else if (r.vencimentoAnterior > 0 && r.indice !== 1.0) {
                row.setAttribute('title', `Baseado no vencimento anterior`);
            }
        }
        
        let colunas = `
            <td>${r.mes}/${r.ano}</td>
            <td>${formatarMoeda(r.vencimento)}</td>
            <td>${(r.indice * 100).toFixed(2).replace('.', ',')}%</td>
        `;
        
        eventos.forEach(evento => {
            const valores = r.valoresEventos[evento.codigo] || { pago: 0, devido: 0, diferenca: 0 };
            colunas += `<td>${formatarMoeda(valores.pago)}</td>`;
            colunas += `<td>${formatarMoeda(valores.devido)}</td>`;
            colunas += `<td class="${valores.diferenca > 0 ? 'destaque-positivo' : valores.diferenca < 0 ? 'destaque-negativo' : ''}">${formatarMoeda(valores.diferenca)}</td>`;
        });
        
        colunas += `<td>${formatarMoeda(r.baseReflexos)}</td>`;
        
        if (incluir13o) {
            colunas += `<td>${formatarMoeda(r.ref13o)}</td>`;
        }
        
        if (incluirFerias) {
            colunas += `<td>${formatarMoeda(r.refFerias)}</td>`;
            colunas += `<td>${formatarMoeda(r.refTerco)}</td>`;
        }
        
        colunas += `<td class="${r.totalMensal > 0 ? 'destaque-positivo' : r.totalMensal < 0 ? 'destaque-negativo' : ''}">${formatarMoeda(r.totalMensal)}</td>`;
        
        if (temCorrecao) {
            const valorCorrigido = r.totalCorrigido || r.totalMensal;
            const temIndice = r.totalCorrigido !== undefined && r.totalCorrigido !== r.totalMensal;
            
            let tooltip = '';
            if (modoCorrecao === 'padrao') {
                tooltip = `<br><small>× ${indicePadraoCorrecao.toFixed(6)} (padrão)</small>`;
            } else if (modoCorrecao === 'csv') {
                const indice = indicesMap.get(r.mes);
                tooltip = indice ? `<br><small>× ${indice.fator.toFixed(6)}</small>` : '<br><small>sem índice</small>';
            }
            
            colunas += `<td class="${temIndice ? 'corrigido' : 'sem-indice'} ${valorCorrigido > r.totalMensal ? 'destaque-positivo' : valorCorrigido < r.totalMensal ? 'destaque-negativo' : ''}">
                ${formatarMoeda(valorCorrigido)}
                ${tooltip}
            </td>`;
        }
        
        row.innerHTML = colunas;
        tableBody.appendChild(row);
    });

    results.style.display = 'block';
}

function exportToCSV() {
    if (todosResultados.length === 0) {
        showMessage('Nenhum dado processado para exportar.', 'error');
        return;
    }

    const incluir13o = document.getElementById('incluir13o').checked;
    const incluirFerias = document.getElementById('incluirFerias').checked;
    const temCorrecao = modoCorrecao !== 'nenhum';
    const eventos = eventosSelecionados;
    
    let cabecalho = ['Competência', 'Vencimento Básico', 'Índice Reajuste (%)', 'Vencimento Anterior (Ref)'];
    
    eventos.forEach(evento => {
        const sigla = evento.codigo === '348' ? 'GSHU' : 
                      evento.codigo === '621' ? 'NOT' : 
                      evento.codigo;
        cabecalho.push(`${sigla} Pago`, `${sigla} Devido`, `Dif ${sigla}`);
    });
    
    cabecalho.push('Base reflexos');
    
    if (incluir13o) cabecalho.push('Reflexo 13º');
    if (incluirFerias) cabecalho.push('Reflexo Férias', '1/3 Constitucional');
    
    cabecalho.push('Total Diferença Mensal');
    
    if (temCorrecao) {
        cabecalho.push('Total Corrigido', 'Fator Aplicado');
    }
    
    // Adiciona coluna de observação
    cabecalho.push('Observação');
    
    const linhas = [cabecalho.join(';')];
    
    todosResultados.forEach(r => {
        let linha = [
            `${r.mes}/${r.ano}`,
            formatarValor(r.vencimento),
            (r.indice * 100).toFixed(2).replace('.', ',') + '%',
            formatarValor(r.vencimentoAnterior || 0)
        ];
        
        eventos.forEach(evento => {
            const valores = r.valoresEventos[evento.codigo] || { pago: 0, devido: 0, diferenca: 0 };
            linha.push(
                formatarValor(valores.pago),
                formatarValor(valores.devido),
                formatarValor(valores.diferenca)
            );
        });
        
        linha.push(formatarValor(r.baseReflexos));
        
        if (incluir13o) linha.push(formatarValor(r.ref13o));
        if (incluirFerias) {
            linha.push(formatarValor(r.refFerias));
            linha.push(formatarValor(r.refTerco));
        }
        
        linha.push(formatarValor(r.totalMensal));
        
        if (temCorrecao) {
            const valorCorrigido = r.totalCorrigido || r.totalMensal;
            
            let fatorStr = '1,000000';
            if (modoCorrecao === 'padrao') {
                fatorStr = indicePadraoCorrecao.toFixed(6).replace('.', ',');
            } else if (modoCorrecao === 'csv') {
                const indice = indicesMap.get(r.mes);
                fatorStr = indice ? indice.fator.toFixed(6).replace('.', ',') : '1,000000';
            }
            
            linha.push(formatarValor(valorCorrigido));
            linha.push(fatorStr);
        }
        
        // Adiciona observação
        let observacao = '';
        if (r.reajusteManual) {
            observacao = `Reajuste manual de ${((r.reajusteManual - 1) * 100).toFixed(2)}%`;
        } else if (r.vencimentoAnterior > 0 && r.indice !== 1.0) {
            observacao = `Reajuste automático baseado no vencimento`;
        }
        linha.push(observacao);
        
        linhas.push(linha.join(';'));
    });
    
    linhas.push('');
    let linhaTotais = `TOTAIS;;;;${eventos.map(() => ';;').join('')};${formatarValor(totalGeralDiferenca)};${formatarValor(totalGeral13o)};${formatarValor(totalGeralFerias)};${formatarValor(totalGeralTerco)};${formatarValor(totalGeralDaAcao)}`;
    
    if (temCorrecao) {
        linhaTotais += `;${formatarValor(totalGeralCorrigido)};`;
    }
    
    // Adiciona observação sobre o modo de reajuste usado
    let observacaoTotal = '';
    if (modoReajusteAtual === 'manual' && percentualReajusteManual > 0) {
        observacaoTotal = `Reajuste manual: ${percentualReajusteManual}% no primeiro mês`;
    } else if (vencimentoBaseAnterior > 0) {
        observacaoTotal = `Vencimento base: R$ ${vencimentoBaseAnterior.toFixed(2)}`;
    }
    
    // Adiciona info sobre valores iniciais
    const valoresIniciaisCount = Object.keys(valoresDevidosIniciais).filter(k => valoresDevidosIniciais[k] > 0).length;
    if (valoresIniciaisCount > 0) {
        const totais = Object.entries(valoresDevidosIniciais)
            .filter(([_, v]) => v > 0)
            .map(([k, v]) => `${k}=R$ ${v.toFixed(2)}`)
            .join('; ');
        observacaoTotal += (observacaoTotal ? ' | ' : '') + `Valores iniciais: ${totais}`;
    }
    
    linhaTotais += `;${observacaoTotal}`;
    
    linhas.push(linhaTotais);
    
    const csvContent = linhas.join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const eventosStr = eventos.map(e => e.codigo).join('_');
    const correcaoStr = temCorrecao ? (modoCorrecao === 'padrao' ? '_PADRAO' : '_CORRIGIDO') : '';
    const reajusteStr = modoReajusteAtual === 'manual' ? `_REAJUSTE_${percentualReajusteManual}PC` : '';
    const vencBaseStr = vencimentoBaseAnterior > 0 ? `_VENCBASE_${Math.round(vencimentoBaseAnterior)}` : '';
    
    link.download = `CALCULO_${eventosStr}${correcaoStr}${reajusteStr}${vencBaseStr}_${!incluir13o ? 'SEM_13O' : ''}${!incluirFerias ? 'SEM_FERIAS' : ''}.csv`;
    link.click();
}

function exportToExcel() {
    exportToCSV();
}

function extrairAnoDoNome(nomeArquivo) {
    const match = nomeArquivo.match(/\d{4}/);
    return match ? parseInt(match[0]) : 0;
}

function arredondar(valor, casas) {
    return Math.round(valor * Math.pow(10, casas)) / Math.pow(10, casas);
}

function formatarValor(valor) {
    return valor.toFixed(2).replace('.', ',');
}

function formatarMoeda(valor) {
    return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

function extrairNumeroMes(nomeMes) {
    const mesesDoAno = [
        'janeiro', 'fevereiro', 'marco', 'abril', 
        'maio', 'junho', 'julho', 'agosto', 
        'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    
    const nomeLower = nomeMes.toLowerCase();
    
    if (nomeLower.includes('13') || nomeLower.includes('13õ') || nomeLower.includes('13ä') || 
        nomeLower.includes('13º') || nomeLower.includes('13∫') || nomeLower.includes('13¤') || 
        nomeLower.includes('13ş')) {
        return 13;
    }
    
    for (let i = 0; i < mesesDoAno.length; i++) {
        if (nomeLower.includes(mesesDoAno[i])) {
            return i + 1;
        }
    }
    
    const nomeSemSimbolos = nomeLower.replace(/[?çãõáéíóú]/g, function(match) {
        const map = {
            '?': '', 'ç': 'c', 'ã': 'a', 'õ': 'o', 
            'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u'
        };
        return map[match] || match;
    });
    
    for (let i = 0; i < mesesDoAno.length; i++) {
        if (nomeSemSimbolos.includes(mesesDoAno[i])) {
            return i + 1;
        }
    }
    
    console.warn(`Mês não reconhecido: ${nomeMes}`);
    return 0;
}

function converterNumeroParaMes(numero) {
    const meses = [
        'Janeiro', 'Fevereiro', 'Marco', 'Abril', 
        'Maio', 'Junho', 'Julho', 'Agosto', 
        'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return meses[numero - 1] || '';
}

// FUNÇÃO PARA PROCESSAR CSV DE ÍNDICES
function processarIndicesCSV(csvText, nomeArquivo) {
    const lines = csvText.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    if (lines.length === 0) {
        showMessage('Arquivo de índices vazio.', 'error');
        return false;
    }

    const header = lines[0].split(';').map(h => h.trim());
    console.log('Cabeçalho do CSV:', header);
    
    // Versão mais flexível para identificar a coluna de fator
    const colunaFator = header.findIndex(col => 
        col.toLowerCase().includes('fator') && col.toLowerCase().includes('acum')
    );
    
    const colunaMesAno = header.findIndex(col => 
        col.toLowerCase().includes('mês') || col.toLowerCase().includes('mes') || col.toLowerCase().includes('ano')
    );
    
    if (colunaFator === -1 || colunaMesAno === -1) {
        showMessage('Formato de CSV não reconhecido. Deve conter colunas de mês/ano e fator acumulado.', 'error');
        return false;
    }
    
    indicesData = [];
    indicesMap.clear();
    
    let linhasProcessadas = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;
        
        const cols = line.split(';').map(c => c.trim().replace(/^["']|["']$/g, ''));
        
        if (cols.length > colunaFator && cols.length > colunaMesAno) {
            const mesAno = cols[colunaMesAno];
            const fatorStr = cols[colunaFator].replace(',', '.');
            const fator = parseFloat(fatorStr);
            
            if (!isNaN(fator) && mesAno) {
                // Tenta extrair mês e ano no formato MM/AAAA
                const partes = mesAno.split('/');
                if (partes.length >= 2) {
                    const mes = parseInt(partes[0]);
                    const ano = partes[1];
                    const nomeMes = converterNumeroParaMes(mes);
                    const chave = `${nomeMes}/${ano}`;
                    
                    indicesMap.set(chave, {
                        fator: fator,
                        mesAno: mesAno
                    });
                    
                    indicesData.push({
                        chave: chave,
                        mes: nomeMes,
                        ano: ano,
                        fator: fator
                    });
                    
                    linhasProcessadas++;
                    console.log(`✅ Índice carregado: ${mesAno} → ${chave} = ${fator}`);
                } else {
                    console.warn(`❌ Formato de data inválido: ${mesAno}`);
                }
            }
        }
    }
    
    if (linhasProcessadas === 0) {
        showMessage('Nenhum índice válido encontrado no arquivo.', 'error');
        return false;
    }
    
    fileIndicesName.textContent = `${nomeArquivo} - ${linhasProcessadas} meses`;
    fileIndicesInfo.style.display = 'flex';
    indicesStatus.innerHTML = `✅ ${linhasProcessadas} índices carregados`;
    indicesStatus.className = 'indices-status success';
    
    console.log(`📊 Total de índices carregados: ${linhasProcessadas}`);
    console.log('📋 TODAS AS CHAVES CARREGADAS:');
    indicesMap.forEach((valor, chave) => {
        console.log(`  "${chave}" = ${valor.fator}`);
    });
    
    showMessage(`${linhasProcessadas} índices carregados com sucesso!`, 'success');
    return true;
}

// FUNÇÃO PRINCIPAL PARA APLICAR CORREÇÃO
function aplicarCorrecao() {
    if (todosResultados.length === 0) {
        showMessage('Processe os dados primeiro.', 'warning');
        return;
    }
    
    const temIndiceCSV = indicesMap.size > 0;
    const temIndicePadrao = indicePadraoInput && indicePadraoInput.value;
    
    if (!temIndiceCSV && !temIndicePadrao) {
        showMessage('Carregue um arquivo de índices OU configure um índice padrão.', 'warning');
        return;
    }
    
    if (!temIndiceCSV && temIndicePadrao) {
        modoCorrecao = 'padrao';
        const indiceInput = indicePadraoInput.value;
        indicePadraoCorrecao = parseFloat(indiceInput.replace(',', '.'));
        console.log(`📊 Usando índice padrão: ${indicePadraoCorrecao}`);
    } else if (temIndiceCSV) {
        modoCorrecao = 'csv';
        console.log(`📊 Usando índices do CSV: ${indicesMap.size} meses`);
    }
    
    console.log('🔍 INICIANDO CORREÇÃO...');
    if (modoCorrecao === 'csv') {
        console.log('Índices disponíveis:', Array.from(indicesMap.keys()).join(', '));
    } else if (modoCorrecao === 'padrao') {
        console.log(`Índice padrão: ${indicePadraoCorrecao} (aplicado a TODOS os meses)`);
    }
    
    let encontrados = 0;
    let naoEncontrados = 0;
    totalGeralCorrigido = 0;
    
    todosResultados.forEach(resultado => {
        if (resultado.mes.includes('13') || resultado.mes.includes('13õ') || resultado.mes.includes('13ä')) {
            console.log(`ℹ️ Ignorando 13º salário: ${resultado.mes}/${resultado.ano}`);
            resultado.totalCorrigido = resultado.totalMensal;
            naoEncontrados++;
            return;
        }
        
        let fatorAplicado = 1.0;
        
        if (modoCorrecao === 'csv') {
            const chaveBusca = `${resultado.mes}/${resultado.ano}`;
            
            let mesLimpo = resultado.mes;
            if (mesLimpo.includes('?')) {
                mesLimpo = mesLimpo.replace('?', 'ç');
            }
            
            let indice = indicesMap.get(chaveBusca);
            
            if (!indice && mesLimpo !== resultado.mes) {
                const chaveLimpa = `${mesLimpo}/${resultado.ano}`;
                indice = indicesMap.get(chaveLimpa);
                if (indice) {
                    console.log(`✅ Mês corrigido: ${resultado.mes} → ${mesLimpo}`);
                }
            }
            
            if (indice) {
                fatorAplicado = indice.fator;
                resultado.totalCorrigido = resultado.totalMensal * fatorAplicado;
                encontrados++;
                totalGeralCorrigido += resultado.totalCorrigido;
                console.log(`✅ ${chaveBusca}: R$ ${resultado.totalMensal.toFixed(2)} × ${fatorAplicado.toFixed(6)} = R$ ${resultado.totalCorrigido.toFixed(2)}`);
            } else {
                resultado.totalCorrigido = resultado.totalMensal;
                naoEncontrados++;
                console.log(`❌ Índice não encontrado para ${chaveBusca}`);
            }
        } else if (modoCorrecao === 'padrao') {
            fatorAplicado = indicePadraoCorrecao;
            resultado.totalCorrigido = resultado.totalMensal * fatorAplicado;
            encontrados++;
            totalGeralCorrigido += resultado.totalCorrigido;
            console.log(`✅ ${resultado.mes}/${resultado.ano}: R$ ${resultado.totalMensal.toFixed(2)} × ${fatorAplicado.toFixed(6)} (padrão) = R$ ${resultado.totalCorrigido.toFixed(2)}`);
        }
    });
    
    renderResults(todosResultados);
    
    if (encontrados > 0) {
        cardTotalCorrigido.style.display = 'block';
        totalCorrigidoElement.textContent = formatarMoeda(totalGeralCorrigido);
    } else {
        cardTotalCorrigido.style.display = 'none';
    }
    
    const mensagem = `📊 Correção aplicada: ${encontrados} meses corrigidos, ${naoEncontrados} ignorados (13º)`;
    indicesStatus.innerHTML = mensagem;
    
    showMessage(`Correção aplicada! ${encontrados} meses corrigidos.`, 'success');
    console.log(mensagem);
}

function exportarCorrigido() {
    if (todosResultados.length === 0) {
        showMessage('Nenhum dado processado para exportar.', 'error');
        return;
    }
    
    if (modoCorrecao === 'nenhum') {
        showMessage('Aplique uma correção primeiro (CSV ou índice padrão).', 'warning');
        return;
    }
    
    exportToCSV();
}

// EVENT LISTENERS PARA UPLOAD DE ÍNDICES
if (uploadIndicesArea) {
    uploadIndicesArea.addEventListener('click', () => fileIndicesInput.click());
    
    uploadIndicesArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadIndicesArea.classList.add('dragover');
    });
    
    uploadIndicesArea.addEventListener('dragleave', () => {
        uploadIndicesArea.classList.remove('dragover');
    });
    
    uploadIndicesArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadIndicesArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleIndicesFile(files[0]);
        }
    });
}

if (fileIndicesInput) {
    fileIndicesInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleIndicesFile(e.target.files[0]);
        }
    });
}

if (clearIndicesFile) {
    clearIndicesFile.addEventListener('click', () => {
        fileIndicesInput.value = '';
        fileIndicesInfo.style.display = 'none';
        indicesData = [];
        indicesMap.clear();
        indicesStatus.innerHTML = '';
        indicesStatus.className = 'indices-status';
        
        if (modoCorrecao === 'csv') {
            modoCorrecao = 'nenhum';
            cardTotalCorrigido.style.display = 'none';
            
            if (todosResultados.length > 0) {
                todosResultados.forEach(r => delete r.totalCorrigido);
                renderResults(todosResultados);
            }
        }
    });
}

if (aplicarCorrecaoBtn) {
    aplicarCorrecaoBtn.addEventListener('click', aplicarCorrecao);
}

if (exportarCorrigidoBtn) {
    exportarCorrigidoBtn.addEventListener('click', exportarCorrigido);
}

function handleIndicesFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showMessage('Arquivo de índices deve ser CSV.', 'error');
        return;
    }
    
    indicesStatus.innerHTML = '⏳ Carregando índices...';
    indicesStatus.className = 'indices-status loading';
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csvData = e.target.result;
            const sucesso = processarIndicesCSV(csvData, file.name);
            
            if (!sucesso) {
                indicesStatus.innerHTML = '❌ Erro ao carregar índices';
                indicesStatus.className = 'indices-status error';
            } else {
                if (todosResultados.length > 0) {
                    renderResults(todosResultados);
                }
            }
        } catch (error) {
            showMessage(`Erro ao ler arquivo de índices: ${error.message}`, 'error');
            indicesStatus.innerHTML = '❌ Erro ao carregar índices';
            indicesStatus.className = 'indices-status error';
        }
    };
    reader.readAsText(file, 'ISO-8859-1');
}

function showMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <span>${type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅'}</span>
        <span>${text}</span>
    `;
    
    messages.innerHTML = '';
    messages.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function clearMessages() {
    messages.innerHTML = '';
}