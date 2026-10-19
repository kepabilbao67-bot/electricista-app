"use client";
import {useEffect,useState} from "react";
export default function ActivarCliente(){
  const [message,setMessage]=useState("Activando el acceso seguro…");
  useEffect(()=>{
    const token=new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null,"","/activar-cliente");
    if(!token){setMessage("Enlace no válido.");return;}
    fetch("/api/auth/activar-cliente",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token}),credentials:"same-origin",cache:"no-store"})
      .then(r=>{if(!r.ok)throw new Error("Enlace caducado o ya utilizado.");window.location.replace("/faltantes-obra");})
      .catch(e=>setMessage(e.message||"No se pudo activar."));
  },[]);
  return <main style={{padding:"3rem 1rem",maxWidth:500,margin:"auto",fontFamily:"sans-serif"}}><h1>Electricista360</h1><p>{message}</p></main>;
}