import { DADOS_LOJA } from '../config/constants.js';

export function isSchedulingOrder() {
    return sessionStorage.getItem('isSchedulingOrder') === 'true';
}

export function clearSchedulingOrder() {
    sessionStorage.removeItem('isSchedulingOrder');
}

export function setSchedulingOrder() {
    sessionStorage.setItem('isSchedulingOrder', 'true');
    window.location.reload();
}

export function setupSchedulingUI() {
    const schedulingNotice = document.createElement('div');
    schedulingNotice.className = 'scheduling-notice';
    schedulingNotice.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <p><strong>Atenção:</strong> Você está no modo de <strong>Agendamento</strong>.</p>
            <button id="cancel-scheduling-btn" style="background: transparent; border: 1px solid #b38200; color: #b38200; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.8em;">
                ✕ Sair do Agendamento e Voltar
            </button>
        </div>`;
    document.querySelector('main').prepend(schedulingNotice);

    document.getElementById('cancel-scheduling-btn').addEventListener('click', () => {
        clearSchedulingOrder();
        window.location.reload();
    });

    const infoBox = document.getElementById('scheduling-info-box');
    const nextDayDateSpan = document.getElementById('next-day-date');

    if (infoBox && nextDayDateSpan) {
        const agora = new Date();
        const horaAtualDecimal = agora.getHours() + (agora.getMinutes() / 60);
        const dataAgendamento = new Date(agora);

        if (horaAtualDecimal >= DADOS_LOJA.horarioAbertura) {
            dataAgendamento.setDate(dataAgendamento.getDate() + 1);
        }

        const dataFormatada = dataAgendamento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const isHoje = (dataAgendamento.getDate() === agora.getDate());
        const textoDia = isHoje ? "HOJE" : "AMANHÃ";

        nextDayDateSpan.textContent = dataFormatada;
        schedulingNotice.querySelector('p').innerHTML = `<strong>Atenção:</strong> Você está agendando um pedido para <strong>${textoDia} (${dataFormatada})</strong>.`;
        infoBox.style.display = 'block';
    }

    const timeBox = document.getElementById('scheduling-time-box');
    const timeSelect = document.getElementById('scheduling-time-select');
    
    if (timeBox && timeSelect) {
        timeSelect.innerHTML = '<option value="">Selecione um horário...</option>';
        for (let time = DADOS_LOJA.horarioAbertura; time <= DADOS_LOJA.horarioFechamento; time += 0.5) {
            const hour = Math.floor(time);
            const minutes = (time % 1) * 60;
            const formattedTime = `${hour.toString()}:${minutes.toString().padStart(2, '0')}`;
            timeSelect.innerHTML += `<option value="${formattedTime}">${formattedTime}</option>`;
        }
        timeBox.style.display = 'block';
    }

    const paymentMethodSelect = document.getElementById('payment-method');
    if (paymentMethodSelect) {
        paymentMethodSelect.value = 'Pix';
        Array.from(paymentMethodSelect.options).forEach(opt => {
            if (opt.value !== 'Pix' && opt.value !== '') opt.disabled = true;
        });
    }
}