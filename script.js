const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
const form = document.querySelector('form');

toggle.addEventListener('click', () => {
  nav.classList.toggle('active');
});

nav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => nav.classList.remove('active'));
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  alert('Quote form is designed. Next step: connect it to email or a form service.');
});
