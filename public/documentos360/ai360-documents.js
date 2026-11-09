/* Documentos 360 optional draft helper. Never reads document or selected file. */
(() => {
  "use strict";
  const aside = document.querySelector("aside");
  const main = document.querySelector("main");
  if (!aside || !main || document.getElementById("d360-ai-panel")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "menu";
  button.textContent = "✨ Ayuda IA360 (QA)";
  button.setAttribute("aria-controls", "d360-ai-panel");
  aside.appendChild(button);

  const panel = document.createElement("section");
  panel.id = "d360-ai-panel";
  panel.className = "hidden";
  const heading = document.createElement("h2");
  heading.textContent = "Ayuda de redacción con APIs360 local";
  const description = document.createElement("p");
  description.className = "note";
  description.textContent = "Solo preguntas generales escritas aquí. No se lee ni se envía el documento, los adjuntos, la firma ni el texto seleccionado. No se modifica el editor.";
  const availability = document.createElement("p");
  availability.setAttribute("role", "status");
  availability.className = "note";
  availability.textContent = "Comprobando disponibilidad local...";
  const form = document.createElement("form");
  form.className = "pane";
  const label = document.createElement("label");
  label.textContent = "Pregunta genérica (sin datos personales)";
  label.setAttribute("for", "d360-ai-question");
  const question = document.createElement("textarea");
  question.id = "d360-ai-question";
  question.maxLength = 900;
  question.rows = 4;
  question.style.cssText = "display:block;width:100%;margin:9px 0;padding:11px;border-radius:8px;color:#172a46;background:#fff";
  question.placeholder = "Ejemplo: ¿Cómo redacto una convocatoria genérica?";
  const send = document.createElement("button");
  send.type = "submit";
  send.textContent = "Crear borrador informativo";
  send.className = "primary";
  send.disabled = true;
  label.appendChild(question);
  form.append(label, send);
  const outputLabel = document.createElement("h2");
  outputLabel.textContent = "Propuesta (revisar antes de utilizar)";
  const output = document.createElement("pre");
  output.setAttribute("aria-live", "polite");
  output.style.cssText = "background:white;color:#172a46;white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;border-radius:10px;min-height:65px";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copiar propuesta";
  copy.disabled = true;
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(output.textContent || "");
      availability.textContent = "Propuesta copiada. Pégala y revísala manualmente.";
    } catch {
      availability.textContent = "El navegador no permite copiar automáticamente. Selecciona el texto.";
    }
  };
  panel.append(heading, description, availability, form, outputLabel, output, copy);
  main.appendChild(panel);

  const originalNav = [...aside.querySelectorAll("button.menu")].filter(item => item !== button);
  originalNav.forEach(item => item.addEventListener("click", () => {
    panel.classList.add("hidden");
    button.classList.remove("active");
  }));
  button.onclick = async () => {
    main.querySelectorAll(":scope > section").forEach(section => section.classList.add("hidden"));
    originalNav.forEach(item => item.classList.remove("active"));
    panel.classList.remove("hidden");
    button.classList.add("active");
    send.disabled = true;
    availability.textContent = "Comprobando APIs360 local...";
    try {
      const res = await fetch("/api/documentos360/ai/status", { cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      const ready = data?.available === true && data?.cloud === false &&
        data?.project === "documentos360" && data?.readsDocuments === false;
      send.disabled = !ready;
      availability.textContent = ready
        ? "Modelo local disponible; coste API externo 0 USD. Sin acceso a documentos."
        : "No disponible en este dispositivo o modo. No se enviará ninguna consulta.";
    } catch {
      availability.textContent = "APIs360 local no disponible. Los documentos siguen siendo locales.";
    }
  };

  form.onsubmit = async event => {
    event.preventDefault();
    if (send.disabled || !question.value.trim()) return;
    output.textContent = "";
    copy.disabled = true;
    send.disabled = true;
    availability.textContent = "Generando propuesta local...";
    try {
      const res = await fetch("/api/documentos360/ai/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.value.trim() }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || result?.source !== "apis360-local" ||
          result?.costUsd !== 0 || result?.readsDocuments !== false ||
          result?.actionExecuted !== false || typeof result?.answer !== "string" ||
          !result.answer.trim()) throw new Error("NO_VERIFIED_LOCAL_DRAFT");
      output.textContent = result.answer;
      copy.disabled = false;
      availability.textContent = "Borrador generado localmente. Comprueba su contenido antes de usarlo.";
    } catch {
      availability.textContent = "No se ha confirmado una propuesta local. No se ha modificado el documento.";
    } finally { send.disabled = false; }
  };
})();
