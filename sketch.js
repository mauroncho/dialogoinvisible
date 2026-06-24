// 🎛️ Parámetros interactivos
const params = {
	// Visuales
	distConexion: 160,
	probConexion: 0.015,
	velGlobal: 2.5,
	tamanoBase: 1.0,
	opacidadLineas: 3.0,
	brilloParticulas: 1.0,
	maxRostros: 15,
	duracionRostro: 1.0, // Minutos
	// Sonoras
	volDrone: 0.7,
	volMedia: 0.6,
	volGrave: 0.7,
};

// Sliders de p5
let sDistConexion,
	sProbConexion,
	sVelGlobal,
	sTamanoBase,
	sOpacidadLineas,
	sBrilloParticulas,
	sMaxRostros,
	sDuracionRostro;
let sVolDrone, sVolMedia, sVolGrave;

const entidades = [];
const conexiones = [];

let video;
let debugMode = true;
let faceMesh;
let rostros = [];
let conexionesRostros = [];
let lastCaptureTime = 0;
let guiDiv;

let port; // Puerto serial

// ⚡ influencias
const influencias = [];

// 📡 serial log
const LOG_MAX = 6;
let serialLogEl;

function preload() {
	// Cargar el modelo antes de que arranque la aplicación
	faceMesh = ml5.faceMesh({ maxFaces: 1 });
}

function setup() {
	createCanvas(windowWidth, windowHeight);

	serialLogEl = document.getElementById("serial-log");

	// Configurar GUI con p5
	guiDiv = createDiv();
	guiDiv.position(10, 10);
	guiDiv.style("background", "rgba(0,0,0,0.5)");
	guiDiv.style("padding", "10px");
	guiDiv.style("color", "white");
	guiDiv.style("font-family", "sans-serif");
	guiDiv.style("font-size", "12px");
	guiDiv.style("display", "flex");
	guiDiv.style("flex-direction", "column");
	guiDiv.style("gap", "5px");
	guiDiv.style("z-index", "100");

	function crearControl(nombre, min, max, val, step) {
		const contenedor = createDiv();
		contenedor.style("display", "flex");
		contenedor.style("justify-content", "space-between");
		contenedor.style("align-items", "center");
		contenedor.style("width", "260px");

		const etiqueta = createSpan(nombre);
		etiqueta.style("width", "100px");

		const slider = createSlider(min, max, val, step);
		slider.style("width", "100px");

		const valor = createSpan(val.toString());
		valor.style("width", "35px");
		valor.style("text-align", "right");

		// Actualizar el texto cuando se mueve el slider
		slider.input(() => {
			valor.html(slider.value());
		});

		contenedor.child(etiqueta);
		contenedor.child(slider);
		contenedor.child(valor);
		guiDiv.child(contenedor);

		return slider;
	}

	createDiv("<b>Visuales</b>").parent(guiDiv);
	sDistConexion = crearControl(
		"Dist. Conexión",
		50,
		300,
		params.distConexion,
		1,
	);
	sProbConexion = crearControl(
		"Prob. Conexión",
		0.001,
		0.1,
		params.probConexion,
		0.001,
	);
	sVelGlobal = crearControl("Velocidad Gral", 0.1, 3.0, params.velGlobal, 0.1);
	sTamanoBase = crearControl("Tamaño Part.", 0.1, 3.0, params.tamanoBase, 0.1);
	sOpacidadLineas = crearControl(
		"Opacidad Líneas",
		0.0,
		5.0,
		params.opacidadLineas,
		0.1,
	);
	sBrilloParticulas = crearControl(
		"Brillo Part.",
		0.1,
		3.0,
		params.brilloParticulas,
		0.1,
	);
	sMaxRostros = crearControl(
		"Máx. Rostros",
		5,
		20,
		params.maxRostros,
		1,
	);
	sDuracionRostro = crearControl(
		"Duración Rostro",
		0.1,
		10.0,
		params.duracionRostro,
		0.1,
	);

	createDiv("<br><b>Sonido (Multipl.)</b>").parent(guiDiv);
	sVolDrone = crearControl("Vol. Drone", 0, 3, params.volDrone, 0.1);
	sVolMedia = crearControl("Vol. Media", 0, 3, params.volMedia, 0.1);
	sVolGrave = crearControl("Vol. Grave", 0, 3, params.volGrave, 0.1);

	reverb = new p5.Reverb();

	// Configuración del puerto serial
	port = createSerial();

	// Intentar abrir el último puerto usado si lo hay
	const usedPorts = usedSerialPorts();
	if (usedPorts.length > 0) {
		port.open(usedPorts[0], 115200); // Típicamente los ESP usan 115200 o 9600
	}

	iniciarDrone();
	iniciarCapa();
	iniciarCapaGrave();
	iniciarPulso();

	// Configuración de Video y ml5.js
	video = createCapture(VIDEO);
	video.size(640, 480);
	video.hide();
	
	// El modelo ya se cargó en preload, solo iniciamos la detección
	faceMesh.detectStart(video, gotFaces);
}

function gotFaces(results) {
	console.log("Detección ml5:", results); // Registro para inspección en Consola
	if (results.length > 0 && rostros.length < params.maxRostros) {
		const ahora = millis();
		if (ahora - lastCaptureTime > 3000) {
			let recorte;
			if (results[0].box) {
				const box = results[0].box;
				console.log("Caja del rostro detectado:", box);
				let x = constrain(box.xMin, 0, video.width);
				let y = constrain(box.yMin, 0, video.height);
				let w = constrain(box.width, 1, video.width - x);
				let h = constrain(box.height, 1, video.height - y);
				recorte = video.get(x, y, w, h);
			} else {
				console.log("Rostro detectado pero sin 'box'. Capturando frame completo.");
				recorte = video.get();
			}
			rostros.push(new Rostro(recorte));
			lastCaptureTime = ahora;
			console.log("Rostro guardado. Cantidad actual:", rostros.length);
		}
	}
}

function draw() {
	// Actualizar parámetros desde los sliders
	params.distConexion = sDistConexion.value();
	params.probConexion = sProbConexion.value();
	params.velGlobal = sVelGlobal.value();
	params.tamanoBase = sTamanoBase.value();
	params.opacidadLineas = sOpacidadLineas.value();
	params.brilloParticulas = sBrilloParticulas.value();
	params.maxRostros = sMaxRostros.value();
	params.duracionRostro = sDuracionRostro.value();

	params.volDrone = sVolDrone.value();
	params.volMedia = sVolMedia.value();
	params.volGrave = sVolGrave.value();

	background(0);

	// ---------------- SERIAL ----------------

	if (port && port.availableBytes() > 0) {
		let str = port.readUntil("\n");
		if (str.length > 0) {
			str = str.trim();
			const partes = str.split(",");

			// Formato esperado: PROBE, MAC, RSSI, SSID
			// Ejemplo: PROBE, 64:1C:AE:DB:CA:D6, -95, BROADCAST
			if (partes.length >= 3 && partes[0] === "PROBE") {
				// Generar una nueva entidad en posición aleatoria
				const x = random(width);
				const y = random(height);

				// Usar el RSSI para modular la vida de la entidad
				const rssi = int(partes[2].trim());
				const ssid = partes.length >= 4 ? partes[3].trim() : "";
				const mac = partes[1].trim();

				const nuevaEntidad = new Entidad(x, y, rssi);
				entidades.push(nuevaEntidad);

				// Mostrar en el log HTML
				logSerialData(mac, rssi, ssid);

				// Si queremos que genere sonido al aparecer
				userStartAudio();
			}
		}
	}

	// ---------------- ROSTROS Y CONEXIONES (OPCIÓN A) ----------------
	
	const ahora = millis();
	const FADE_DURACION = 3000; // últimos 3 segundos se desvanece

	for (let i = rostros.length - 1; i >= 0; i--) {
		let r = rostros[i];
		// Verificar tiempo según el slider de duración (en minutos)
		let duracion = params.duracionRostro * 60 * 1000;
		let edad = ahora - r.timestamp;
		if (edad > duracion) {
			rostros.splice(i, 1);
		} else {
			r.opacidad = edad > duracion - FADE_DURACION 
				? map(edad, duracion - FADE_DURACION, duracion, 120, 0)
				: 120;
			r.dibujar();
		}
	}

	for (let i = conexionesRostros.length - 1; i >= 0; i--) {
		let c = conexionesRostros[i];
		c.actualizar();
		if (c.energia <= 0 || !rostros.includes(c.r1) || !rostros.includes(c.r2)) {
			conexionesRostros.splice(i, 1);
		} else {
			c.dibujar();
		}
	}

	// ---------------- ENTIDADES ----------------

	// Eliminar entidades expiradas
	for (let i = entidades.length - 1; i >= 0; i--) {
		const edad = ahora - entidades[i].nacimiento;
		if (edad > entidades[i].vidaTotal) {
			entidades.splice(i, 1);
		}
	}

	for (const e of entidades) {
		const edad = ahora - e.nacimiento;
		e.opacidad =
			edad > e.vidaTotal - FADE_DURACION
				? map(edad, e.vidaTotal - FADE_DURACION, e.vidaTotal, 1, 0)
				: 1;
		e.mover();
		e.dibujar();
	}

	// ---------------- CONEXIONES ----------------

	// 1. Limpieza y decaimiento de conexiones antiguas
	for (let i = conexiones.length - 1; i >= 0; i--) {
		conexiones[i].vida -= 0.015; // Se desvanecen gradualmente (~1 segundo)
		if (conexiones[i].vida <= 0.02) {
			conexiones.splice(i, 1);
		}
	}

	// 2. Generación de nuevas conexiones
	for (let i = 0; i < entidades.length; i++) {
		for (let j = i + 1; j < entidades.length; j++) {
			const a = entidades[i];
			const b = entidades[j];
			const d = dist(a.x, a.y, b.x, b.y);

			if (d < params.distConexion && random() < params.probConexion) {
				conexiones.push(new Conexion(a, b, d));

				// energía visual
				a.energia += 0.6;
				b.energia += 0.6;

				// influencia sonora
				influencias.push({
					fuerza: map(d, 0, params.distConexion, 0.6, 0.2),
					vida: 1.0,
				});
			}
		}
	}

	for (const c of conexiones) {
		c.dibujar();
	}

	// ---------------- INFLUENCIAS ----------------

	for (let i = influencias.length - 1; i >= 0; i--) {
		influencias[i].vida *= 0.96;

		if (influencias[i].vida < 0.03) {
			influencias.splice(i, 1);
		}
	}

	// ---------------- PULSO ----------------

	energiaPulso += influencias.length * 0.002;
	energiaPulso *= 0.98;
	energiaPulso = constrain(energiaPulso, 0, 1);

	const intervalo = map(energiaPulso, 0, 1, 2200, 600);

	if (ahora - ultimoPulso > intervalo && energiaPulso > 0.05) {
		dispararPulso();
		ultimoPulso = ahora;
	}

	// ---------------- SONIDO ----------------

	let densidad = conexiones.length / 60;
	densidad = constrain(densidad, 0, 1);

	actualizarCampo(densidad);

	// Dibujar miniatura de depuración de la webcam
	if (debugMode && video) {
		push();
		stroke(255);
		strokeWeight(2);
		image(video, width - 170, 10, 160, 120);
		fill(255);
		noStroke();
		textSize(10);
		text("DEBUG CAM", width - 165, 25);
		pop();
	}
}



// ---------------- INPUT ----------------

function mousePressed() {
	userStartAudio();
	// entidades.push(new Entidad(mouseX, mouseY));
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
	if (key === "c" || key === "C") {
		userStartAudio(); // Aseguramos que arranque el audio también
		if (!port.opened()) {
			port.open(115200); // Abre el diálogo del navegador para elegir puerto
		} else {
			port.close(); // Cierra la conexión si ya estaba abierta
		}
	}
	if (key === "h" || key === "H") {
		debugMode = !debugMode;
		if (guiDiv) {
			guiDiv.style("display", debugMode ? "flex" : "none");
		}
	}
}



// ---------------- SERIAL LOG (HTML) ----------------

function logSerialData(mac, rssi, ssid) {
	if (!serialLogEl) return;

	// Armar el texto a mostrar
	let texto = `${mac}  ${rssi}dBm`;
	if (ssid && ssid !== "BROADCAST") {
		texto += `  ${ssid}`;
	}

	// Crear el elemento
	const entry = document.createElement("div");
	entry.className = "log-entry";
	entry.textContent = texto;

	// Agregar al final (el más nuevo abajo)
	serialLogEl.appendChild(entry);

	// Si hay más de LOG_MAX, eliminar el más viejo con animación
	const activeLogs = serialLogEl.querySelectorAll(".log-entry:not(.removing)");
	if (activeLogs.length > LOG_MAX) {
		const diff = activeLogs.length - LOG_MAX;
		for (let i = 0; i < diff; i++) {
			const oldest = activeLogs[i];
			oldest.classList.add("removing");
			oldest.addEventListener("animationend", () => oldest.remove(), {
				once: true,
			});
			// Fallback por si la animación no se dispara
			setTimeout(() => {
				if (oldest.parentNode) oldest.remove();
			}, 500);
		}
	}
}

