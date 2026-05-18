const setupForTriagemMode = (props) => {
  const container = document.createElement('div');
  const btn1 = document.createElement('button');
  btn1.textContent = 'Mensagem Rápida';
  const btn2 = document.createElement('button');
  btn2.textContent = 'Relatório Detalhado';
  container.appendChild(btn1);
  container.appendChild(btn2);
  return { container };
};

module.exports = { setupForTriagemMode };