/** Corre antes do primeiro desenho para não piscar: tema guardado ou o do sistema. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;
