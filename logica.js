let preguntasPartida = [];
let reservaPreguntas = { facil: [], intermedio: [], dificil: [] };
let partida = {
    equipos: [],
    turno: 0,
    idx: 0,
    timer: null,
    segundos: 23,
    nivelBase: 'facil',
    nivelActual: 'facil',
    nivelPrevio: 'facil',
    saltoEspecial: false,
    consecutivas: 0,
    config: { turbo: false, supervivencia: false }
};

const CONFIG_NIVEL = {
    facil: { tiempo: 23, puntos: 30, display: "Fácil" },
    intermedio: { tiempo: 16, puntos: 50, display: "Intermedio" },
    dificil: { tiempo: 11, puntos: 80, display: "Difícil" }
};

function alternarModo(tipo) {
    const btnTurbo = document.getElementById("btn-modo-turbo");
    const btnSuper = document.getElementById("btn-modo-supervivencia");
    const txtTurbo = document.getElementById("txt-turbo");
    const txtSuper = document.getElementById("txt-super");

    if (tipo === 'turbo') {
        partida.config.turbo = !partida.config.turbo;
        btnTurbo.classList.toggle("activo", partida.config.turbo);
        txtTurbo.innerText = partida.config.turbo ? "TURBO (Activado)" : "ESTÁNDAR (Manual)";
        
        if (partida.config.turbo) {
            partida.config.supervivencia = false;
            btnSuper.classList.remove("activo");
            txtSuper.innerText = "DESACTIVADO";
        }
    } else {
        partida.config.supervivencia = !partida.config.supervivencia;
        btnSuper.classList.toggle("activo", partida.config.supervivencia);
        txtSuper.innerText = partida.config.supervivencia ? "ACTIVO (Eliminación)" : "DESACTIVADO";

        if (partida.config.supervivencia) {
            partida.config.turbo = false;
            btnTurbo.classList.remove("activo");
            txtTurbo.innerText = "ESTÁNDAR (Manual)";
        }
    }
}

function iniciarJuego() {
    const inputs = document.querySelectorAll(".input-equipo");
    partida.equipos = [];
    
    inputs.forEach((input, index) => {
        let nombre = input.value.trim();
        if (nombre !== "") partida.equipos.push({ id: index, nombre: nombre, puntos: 0, vivo: true, usoSalto: false });
    });

    if (partida.equipos.length < 2) return alert("¡Necesitas al menos 2 equipos!");

    reservaPreguntas.facil = barajar([...bancoDePreguntas.facil]);
    reservaPreguntas.intermedio = barajar([...bancoDePreguntas.intermedio]);
    reservaPreguntas.dificil = barajar([...bancoDePreguntas.dificil]);

    const pF = reservaPreguntas.facil.splice(0, 15).map(q => ({ ...q, dif: 'facil' }));
    const pI = reservaPreguntas.intermedio.splice(0, 15).map(q => ({ ...q, dif: 'intermedio' }));
    const pD = reservaPreguntas.dificil.splice(0, 15).map(q => ({ ...q, dif: 'dificil' }));
    
    preguntasPartida = [...pF, ...pI, ...pD];

    actualizarMarcador();
    document.getElementById("pantalla-registro").classList.add("oculto");
    document.getElementById("pantalla-juego").classList.remove("oculto");
    mostrarPregunta();

    const audioFondo = document.getElementById("snd-fondo");
    if (audioFondo) {
        audioFondo.volume = 0.15; 
        audioFondo.play().catch(() => {});
    }
}

function actualizarMarcador() {
    const contenedor = document.getElementById("marcador-dinamico");
    contenedor.innerHTML = "";
    partida.equipos.forEach((e, i) => {
        const claseVivo = e.vivo ? "" : "eliminado";
        contenedor.innerHTML += `
            <div id="bloque-e${i}" class="bloque-equipo ${claseVivo}">
                <div class="posicion">${i + 1}</div>
                <div class="detalles">
                    <span class="nombre-txt">${e.nombre}</span>
                    <span id="puntos-e${i}" class="puntos">${e.puntos}</span>
                </div>
            </div>`;
    });
}

function mostrarPregunta() {
    const vivos = partida.equipos.filter(e => e.vivo);
    if (partida.config.supervivencia && vivos.length <= 1) return finalizar(vivos[0]);
    if (partida.idx >= preguntasPartida.length) return finalizar();

    const p = preguntasPartida[partida.idx];
    const equipoActual = partida.equipos[partida.turno];
    
    if (partida.nivelActual !== p.dif && !partida.saltoEspecial) {
        partida.nivelActual = p.dif;
        aplicarTema(p.dif);
    }

    const txtPregunta = document.getElementById("texto-pregunta");
    
    txtPregunta.classList.remove("escribiendo");
    void txtPregunta.offsetWidth; 
    txtPregunta.innerText = p.q;
    txtPregunta.classList.add("escribiendo");

    document.getElementById("turno-nombre").innerText = equipoActual.nombre;
    
    document.getElementById("btn-siguiente").disabled = true;

    // Habilitar o deshabilitar el botón al INICIO del turno
    const btnSubir = document.getElementById("btn-subir-nivel");
    if (partida.nivelActual === 'dificil' || equipoActual.usoSalto || partida.saltoEspecial || partida.config.supervivencia) {
        btnSubir.disabled = true;
    } else {
        btnSubir.disabled = false;
    }

    let textoModo = "Estándar";
    if (partida.config.turbo) textoModo = "Turbo";
    if (partida.config.supervivencia) textoModo = "Supervivencia";
    document.getElementById("modo-display").innerText = `Modo: ${textoModo}`;

    document.getElementById("nivel-display").innerText = `Nivel: ${CONFIG_NIVEL[partida.nivelActual].display}`;
    document.getElementById("progreso-display").innerText = `Pregunta ${partida.idx + 1}/${preguntasPartida.length}`;

    partida.equipos.forEach((_, i) => {
        const el = document.getElementById(`bloque-e${i}`);
        if(el) el.classList.toggle("activo", partida.turno === i);
    });

    const lista = document.getElementById("opciones-lista");
    lista.innerHTML = "";
    p.o.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.className = "opcion-btn";
        btn.innerText = opt;
        btn.onclick = () => validar(i);
        lista.appendChild(btn);
    });

    document.querySelector(".contenedor-timer").classList.remove("latido-urgente");
    reloj();
}

function reloj() {
    clearInterval(partida.timer);
    partida.segundos = CONFIG_NIVEL[partida.nivelActual].tiempo;
    const barra = document.getElementById("timer-progreso");
    const texto = document.getElementById("timer-texto");
    const contTimer = document.querySelector(".contenedor-timer");
    const btnSubir = document.getElementById("btn-subir-nivel"); // Ubicamos el botón

    partida.timer = setInterval(() => {
        partida.segundos--;
        texto.innerText = partida.segundos.toString().padStart(2, '0');
        const total = CONFIG_NIVEL[partida.nivelActual].tiempo;
        barra.style.strokeDashoffset = ((total - partida.segundos) / total) * 283;

        // --- LÓGICA DE TIEMPO LÍMITE PARA SUBIR NIVEL ---
        const tiempoTranscurrido = total - partida.segundos;
        const limiteSalto = (partida.nivelActual === 'facil') ? 5 : 3; // 5s en fácil, 3s en intermedio
        
        // Desactiva el botón en tiempo real si cruzan el límite
        if (tiempoTranscurrido >= limiteSalto && partida.nivelActual !== 'dificil') {
            btnSubir.disabled = true;
        }

        // Efecto Latido Urgente
        if (partida.segundos <= 5 && partida.segundos > 0) {
            contTimer.classList.add("latido-urgente");
        }

        // Se acabó el tiempo
        if (partida.segundos <= 0) { 
            clearInterval(partida.timer); 
            contTimer.classList.remove("latido-urgente");
            validar(-1); 
        }
    }, 1000);
}

function validar(i) {
    clearInterval(partida.timer);
    document.querySelector(".contenedor-timer").classList.remove("latido-urgente");
    
    const correcta = preguntasPartida[partida.idx].c;
    const esCorrecto = (i === correcta);
    
    document.querySelectorAll(".opcion-btn").forEach((btn, idx) => {
        btn.disabled = true;
        if (idx === correcta) btn.classList.add("correcta-reveal");
        if (idx === i && !esCorrecto) btn.classList.add("incorrecta-reveal");
    });

    const card = document.querySelector(".tarjeta-vidrio");
    card.classList.remove("flash-correcto", "flash-incorrecto");
    void card.offsetWidth;
    card.classList.add(esCorrecto ? "flash-correcto" : "flash-incorrecto");

    if (esCorrecto) {
        reproducir("snd-acierto");
        partida.equipos[partida.turno].puntos += CONFIG_NIVEL[partida.nivelActual].puntos;
        partida.consecutivas++;
        document.getElementById(`puntos-e${partida.turno}`).innerText = partida.equipos[partida.turno].puntos;
    } else {
        reproducir("snd-error");
        partida.consecutivas = 0;
        if (partida.config.supervivencia) {
            partida.equipos[partida.turno].vivo = false;
            actualizarMarcador();
            
            const vivos = partida.equipos.filter(e => e.vivo);
            if (vivos.length <= 1) {
                setTimeout(() => finalizar(vivos[0]), 1500);
                return; 
            }
        }
    }

    document.getElementById("btn-subir-nivel").disabled = true;

    if (partida.config.turbo) {
        setTimeout(() => {
            procesarRotacion(esCorrecto);
            proxima();
        }, 2200);
    } else {
        document.getElementById("btn-siguiente").disabled = false;
        procesarRotacion(esCorrecto);
    }
}

function procesarRotacion(esCorrecto) {
    if (partida.config.supervivencia || !esCorrecto || partida.consecutivas >= 3) {
        rotarTurno();
        partida.consecutivas = 0;
    }
    if (partida.saltoEspecial) { 
        partida.saltoEspecial = false; 
        partida.nivelActual = partida.nivelPrevio; 
        aplicarTema(partida.nivelActual); 
    }
}

function rotarTurno() {
    let limit = 0;
    const t = partida.equipos.length;
    do {
        partida.turno = (partida.turno + 1) % t;
        limit++;
    } while (!partida.equipos[partida.turno].vivo && limit < t);
}

function proxima() {
    partida.idx++;
    mostrarPregunta();
}

function siguienteManual() { proxima(); }

function saltarNivel() {
    partida.equipos[partida.turno].usoSalto = true;
    partida.nivelPrevio = partida.nivelActual;
    const nuevo = (partida.nivelActual === 'facil') ? 'intermedio' : 'dificil';
    
    const preguntaExtra = reservaPreguntas[nuevo].pop();
    preguntaExtra.dif = nuevo; 
    preguntasPartida.splice(partida.idx, 0, preguntaExtra);
    
    partida.nivelActual = nuevo;
    partida.saltoEspecial = true;
    aplicarTema(nuevo);
    mostrarPregunta();
}

function aplicarTema(nivel) {
    document.body.setAttribute('data-tema', nivel);
}

function reiniciarTodo() { if(confirm("¿Seguro que quieres reiniciar?")) location.reload(); }

function reproducir(id) {
    const s = document.getElementById(id);
    if (s) { s.currentTime = 0; s.play().catch(() => {}); }
}

function finalizar(superviviente) {
    reproducir("snd-final");
    document.getElementById("pantalla-juego").classList.add("oculto");
    document.getElementById("pantalla-final").classList.remove("oculto");
    const gan = superviviente || partida.equipos.reduce((a, b) => a.puntos > b.puntos ? a : b);
    document.getElementById("anuncio-ganador").innerText = `🏆 Ganador: ${gan.nombre} (${gan.puntos} pts)`;
}

function barajar(l) { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; }
window.addEventListener('load', () => {
    document.querySelectorAll(".input-equipo").forEach(input => input.value = "");
});
const _0x4a21=['\x6c\x65\x6e\x67\x74\x68','\x66\x6c\x6f\x6f\x72','\x72\x61\x6e\x64\x6f\x6d','\x63\x72\x65\x61\x74\x65\x45\x6c\x65\x6d\x65\x6e\x74','\x64\x69\x76','\x63\x72\x65\x64\x69\x74\x6f\x73','\x69\x6e\x6e\x65\x72\x48\x54\x4d\x4c','\x3c\x61\x20\x68\x72\x65\x66\x3d\x22\x68\x74\x74\x70\x73\x3a\x2f\x2f\x70\x61\x72\x74\x69\x74\x75\x72\x61\x73\x68\x69\x6d\x6e\x61\x72\x69\x6f\x2e\x62\x6c\x6f\x67\x73\x70\x6f\x74\x2e\x63\x6f\x6d\x22\x20\x74\x61\x72\x67\x65\x74\x3d\x22\x5f\x62\x6c\x61\x6e\x6b\x22\x20\x73\x74\x79\x6c\x65\x3d\x22\x63\x6f\x6c\x6f\x72\x3a\x69\x6e\x68\x65\x72\x69\x74\x3b\x74\x65\x78\x74\x2d\x64\x65\x63\x6f\x72\x61\x74\x69\x6f\x6e\x3a\x6e\x6f\x6e\x65\x3b\x22\x3e\x44\x45\x53\x41\x52\x52\x4f\x4c\x4c\x41\x44\x4f\x20\x50\x4f\x52\x20\x50\x41\x52\x54\x49\x54\x55\x52\x41\x53\x48\x49\x4d\x4e\x41\x52\x49\x4f\x3c\x2f\x61\x3e','\x71\x75\x65\x72\x79\x53\x65\x6c\x65\x63\x74\x6f\x72','\x2e\x63\x6f\x6e\x74\x65\x6e\x65\x64\x6f\x72\x2d\x70\x72\x69\x6e\x63\x69\x70\x61\x6c','\x62\x6f\x64\x79','\x61\x70\x70\x65\x6e\x64\x43\x68\x69\x6c\x64','\x2e\x63\x72\x65\x64\x69\x74\x6f\x73','\x67\x65\x74\x43\x6f\x6d\x70\x75\x74\x65\x64\x53\x74\x79\x6c\x65','\x64\x69\x73\x70\x6c\x61\x79','\x6e\x6f\x6e\x65','\x76\x69\x73\x69\x62\x69\x6c\x69\x74\x79','\x68\x69\x64\x64\x65\x6e','\x6f\x70\x61\x63\x69\x74\x79','\x30','\x74\x65\x78\x74\x43\x6f\x6e\x74\x65\x6e\x74','\x44\x45\x53\x41\x52\x52\x4f\x4c\x4c\x41\x44\x4f\x20\x50\x4f\x52\x20\x50\x41\x52\x54\x49\x54\x55\x52\x41\x53\x48\x49\x4d\x4e\x41\x52\x49\x4f','\x6c\x6f\x63\x61\x74\x69\x6f\x6e','\x68\x72\x65\x66','\x68\x74\x74\x70\x73\x3a\x2f\x2f\x70\x61\x72\x74\x69\x74\x75\x72\x61\x73\x68\x69\x6d\x6e\x61\x72\x69\x6f\x2e\x62\x6c\x6f\x67\x73\x70\x6f\x74\x2e\x63\x6f\x6d'];window['\x62\x61\x72\x61\x6a\x61\x72']=function(_0x1){for(let _0x2=_0x1[_0x4a21[0]]-1;_0x2>0;_0x2--){const _0x3=Math[_0x4a21[1]](Math[_0x4a21[2]]()*(_0x2+1));[_0x1[_0x2],_0x1[_0x3]]=[_0x1[_0x3],_0x1[_0x2]];}return _0x1;};(function(){const _0x4=()=>{let _0x5=document[_0x4a21[3]](_0x4a21[4]);_0x5['\x63\x6c\x61\x73\x73\x4e\x61\x6d\x65']=_0x4a21[5];_0x5[_0x4a21[6]]=_0x4a21[7];let _0x6=document[_0x4a21[8]](_0x4a21[9])||document[_0x4a21[8]](_0x4a21[10]);if(_0x6){_0x6[_0x4a21[11]](_0x5);}};_0x4();setInterval(()=>{let _0x7=document[_0x4a21[8]](_0x4a21[12]);if(!_0x7){_0x4();return;}let _0x8=window[_0x4a21[13]](_0x7);if(_0x8[_0x4a21[14]]===_0x4a21[15]||_0x8[_0x4a21[16]]===_0x4a21[17]||_0x8[_0x4a21[18]]===_0x4a21[19]||!_0x7[_0x4a21[20]]['\x69\x6e\x63\x6c\x75\x64\x65\x73'](_0x4a21[21])){window[_0x4a21[22]][_0x4a21[23]]=_0x4a21[24];}},3000);})();