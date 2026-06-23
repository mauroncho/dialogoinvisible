// 🎛️ Parámetros interactivos
const params = {
	// Visuales
	distConexion: 160,
	probConexion: 0.015,
	velGlobal: 1.0,
	tamanoBase: 1.0,
	opacidadLineas: 3.0,
	brilloParticulas: 1.0,
	maxRostros: 5,
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
	sMaxRostros;
let sVolDrone, sVolMedia, sVolGrave;

const entidades = [];
const conexiones = [];

let video;
let faceMesh;
let rostros = [];
let conexionesRostros = [];
let lastCaptureTime = 0;

let reverb;
let port; // Puerto serial

// 🌫️ capas sonoras
const drone = [];
const capa = [];
const capaGrave = [];

// ⚡ influencias
const influencias = [];

// 📡 serial log
const LOG_MAX = 6;
let serialLogEl;

// 🫀 pulso
let pulsoOsc, pulsoOsc2;
let pulsoEnv;

let energiaPulso = 0;
let ultimoPulso = 0;

function setup() {
	createCanvas(windowWidth, windowHeight);

	serialLogEl = document.getElementById("serial-log");

	// Configurar GUI con p5
	const guiDiv = createDiv();
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
		0,
		15,
		params.maxRostros,
		1,
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
	faceMesh = ml5.faceMesh(video, { maxFaces: 1 });
	faceMesh.detectStart(video, gotFaces);
}

function gotFaces(results) {
	if (results.length > 0 && rostros.length < params.maxRostros) {
		const ahora = millis();
		if (ahora - lastCaptureTime > 3000) {
			let recorte;
			if (results[0].box) {
				const box = results[0].box;
				let x = constrain(box.xMin, 0, video.width);
				let y = constrain(box.yMin, 0, video.height);
				let w = constrain(box.width, 1, video.width - x);
				let h = constrain(box.height, 1, video.height - y);
				recorte = video.get(x, y, w, h);
			} else {
				recorte = video.get();
			}
			rostros.push(new Rostro(recorte));
			lastCaptureTime = ahora;
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
		// 10 minutos = 10 * 60 * 1000 ms
		if (ahora - r.timestamp > 10 * 60 * 1000) {
			rostros.splice(i, 1);
		} else {
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
}

// ---------------- DRONE ----------------

function iniciarDrone() {
	for (let i = 0; i < 3; i++) {
		const osc = new p5.Oscillator("sine");

		osc.freq(random(80, 120));
		osc.amp(0.03);
		osc.start();

		reverb.process(osc, 10, 5);

		drone.push({
			osc: osc,
			offset: random(1000),
		});
	}
}

// ---------------- CAPA MEDIA ----------------

function iniciarCapa() {
	for (let i = 0; i < 2; i++) {
		const osc = new p5.Oscillator("triangle");

		osc.freq(random(150, 250));
		osc.amp(0.015);
		osc.start();

		reverb.process(osc, 8, 4);

		capa.push({
			osc: osc,
			offset: random(1000),
		});
	}
}

// ---------------- CAPA GRAVE ----------------

function iniciarCapaGrave() {
	for (let i = 0; i < 2; i++) {
		const osc = new p5.Oscillator("sine");

		osc.freq(random(60, 80));
		osc.amp(0.04);
		osc.start();

		reverb.process(osc, 12, 6);

		capaGrave.push({
			osc: osc,
			offset: random(1000),
		});
	}
}

// ---------------- PULSO ----------------

function iniciarPulso() {
	pulsoOsc = new p5.Oscillator("sine");
	pulsoOsc.freq(60);
	pulsoOsc.amp(0);
	pulsoOsc.start();

	// armónico
	pulsoOsc2 = new p5.Oscillator("triangle");
	pulsoOsc2.freq(120);
	pulsoOsc2.amp(0);
	pulsoOsc2.start();

	pulsoEnv = new p5.Envelope();
	pulsoEnv.setADSR(0.15, 0.3, 0.0, 0.8);
	pulsoEnv.setRange(0.25, 0);

	reverb.process(pulsoOsc, 10, 4);
	reverb.process(pulsoOsc2, 8, 3);
}

function dispararPulso() {
	const notas = [55, 62, 73]; // E–F–G más audibles

	const freq = random(notas);

	pulsoOsc.freq(freq, 0.2);
	pulsoOsc2.freq(freq * 2, 0.2);

	pulsoEnv.play(pulsoOsc);
	pulsoEnv.play(pulsoOsc2);
}

// ---------------- CAMPO SONORO ----------------

function actualizarCampo(densidad) {
	let empujeFreq = 0;
	let empujeAmp = 0;

	for (const inf of influencias) {
		empujeFreq += inf.fuerza * inf.vida * 25;
		empujeAmp += inf.fuerza * inf.vida * 0.015;
	}

	// DRONE
	for (const d of drone) {
		const n = noise(frameCount * 0.0002 + d.offset);

		const base = map(n, 0, 1, 70, 130);
		const f = base + empujeFreq * 0.1;

		d.osc.freq(f);

		const a = (map(n, 0, 1, 0.02, 0.035) + empujeAmp) * params.volDrone;
		d.osc.amp(a, 3);
	}

	// CAPA MEDIA
	for (const c of capa) {
		const n = noise(frameCount * 0.0008 + c.offset);

		const base = map(n, 0, 1, 120, 260);
		const f = base + empujeFreq * 0.2 + densidad * 30;

		c.osc.freq(f);

		const a = (map(densidad, 0, 1, 0.005, 0.025) + empujeAmp) * params.volMedia;
		c.osc.amp(a, 2);
	}

	// CAPA GRAVE
	for (const g of capaGrave) {
		const n = noise(frameCount * 0.00015 + g.offset);

		const base = map(n, 0, 1, 45, 90);
		const f = base + empujeFreq * 0.05;

		g.osc.freq(f);

		const a = (map(densidad, 0, 1, 0.03, 0.055) + empujeAmp) * params.volGrave;
		g.osc.amp(a, 3);
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
}

// ---------------- ENTIDAD ----------------

class Entidad {
	constructor(x, y, rssi = -70) {
		this.x = x;
		this.y = y;

		this.vx = random(-0.4, 0.4);
		this.vy = random(-0.4, 0.4);

		this.tam = random(4, 8);
		this.seed = random(1000);
		this.velBase = random(0.3, 0.8);

		this.energia = 0;
		this.nacimiento = millis(); // momento de creación
		this.opacidad = 1; // se actualiza en draw()

		// RSSI modula la vida: señal fuerte (-30) = vida corta, señal débil (-100) = vida larga
		this.rssi = constrain(rssi, -100, -30);
		this.vidaTotal = map(this.rssi, -100, -30, 20000, 8000); // 8s a 20s
		this.ultimoRostro = null;
	}

	mover() {
		const n = noise(
			this.x * 0.002,
			this.y * 0.002,
			frameCount * 0.0008 + this.seed,
		);
		const angulo = n * TWO_PI * 2;

		this.vx += cos(angulo) * 0.015;
		this.vy += sin(angulo) * 0.015;

		this.vx *= 0.98;
		this.vy *= 0.98;

		// Atracción hacia rostros y polinización (Opción A)
		let closestRostro = null;
		let minDist = Infinity;
		for (let r of rostros) {
			let d = dist(this.x, this.y, r.x, r.y);
			if (d < minDist) {
				minDist = d;
				closestRostro = r;
			}
		}

		if (closestRostro) {
			// Gravedad suave
			let forceX = closestRostro.x - this.x;
			let forceY = closestRostro.y - this.y;
			let distToCenter = sqrt(forceX * forceX + forceY * forceY);
			if (distToCenter > 0) {
				forceX /= distToCenter;
				forceY /= distToCenter;
			}
			this.vx += forceX * 0.005;
			this.vy += forceY * 0.005;

			// Lógica de Polinización
			if (minDist < params.distConexion) {
				if (this.ultimoRostro !== closestRostro) {
					if (this.ultimoRostro != null) {
						let found = false;
						for (let c of conexionesRostros) {
							if ((c.r1 === this.ultimoRostro && c.r2 === closestRostro) ||
								(c.r2 === this.ultimoRostro && c.r1 === closestRostro)) {
								c.energia = min(c.energia + 1.0, 5.0);
								found = true;
								break;
							}
						}
						if (!found) {
							conexionesRostros.push(new ConexionRostros(this.ultimoRostro, closestRostro));
						}
					}
					this.ultimoRostro = closestRostro;
				}
			}
		}

		this.x += this.vx * this.velBase * params.velGlobal;
		this.y += this.vy * this.velBase * params.velGlobal;

		if (this.x < 0 || this.x > width) this.vx *= -1;
		if (this.y < 0 || this.y > height) this.vy *= -1;

		this.energia *= 0.9;
	}

	dibujar() {
		noStroke();

		for (let i = 5; i > 0; i--) {
			fill(255, 15 * this.opacidad * params.brilloParticulas);
			ellipse(this.x, this.y, this.tam * i * 1.4 * params.tamanoBase);
		}

		const brillo = constrain(this.energia, 0, 1);

		const alpha =
			map(brillo, 0, 1, 60, 200) * this.opacidad * params.brilloParticulas;
		const tamNucleo =
			this.tam * map(brillo, 0, 1, 0.6, 1.5) * params.tamanoBase;

		fill(255, alpha);
		ellipse(this.x, this.y, tamNucleo);
	}
}

// ---------------- CONEXION ----------------

class Conexion {
	constructor(a, b, d) {
		this.a = a;
		this.b = b;
		this.distancia = d;
		this.seed = random(1000);
		this.vida = 1.0; // Ciclo de vida para desvanecerse
	}

	dibujar() {
		noFill();

		// Actualizar la distancia por si las entidades se movieron
		this.distancia = dist(this.a.x, this.a.y, this.b.x, this.b.y);

		const alphaBase = map(this.distancia, 0, params.distConexion, 80, 15);
		const alpha = alphaBase * params.opacidadLineas * this.vida;
		stroke(255, alpha);
		strokeWeight(0.8);

		beginShape();

		const pasos = 10;

		for (let i = 0; i <= pasos; i++) {
			const t = i / pasos;

			let x = lerp(this.a.x, this.b.x, t);
			let y = lerp(this.a.y, this.b.y, t);

			const n = noise(x * 0.01, y * 0.01, frameCount * 0.01 + this.seed);
			const offset = map(n, 0, 1, -10, 10);

			const angle = atan2(this.b.y - this.a.y, this.b.x - this.a.x);
			const perp = angle + HALF_PI;

			x += cos(perp) * offset * sin(t * PI);
			y += sin(perp) * offset * sin(t * PI);

			curveVertex(x, y);
		}

		endShape();
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

// ---------------- CLASES ROSTROS ----------------

class Rostro {
	constructor(img) {
		this.img = img;
		this.x = random(100, width - 100);
		this.y = random(100, height - 100);
		this.timestamp = millis();
	}

	dibujar() {
		push();
		imageMode(CENTER);
		tint(255, 120); 
		image(this.img, this.x, this.y, 100, 100);
		pop();
	}
}

class ConexionRostros {
	constructor(r1, r2) {
		this.r1 = r1;
		this.r2 = r2;
		this.energia = 1.0;
	}

	actualizar() {
		this.energia -= 0.002;
	}

	dibujar() {
		if (this.energia <= 0) return;
		push();
		let weight = map(this.energia, 0, 5, 1, 6);
		strokeWeight(weight);
		let alpha = map(min(this.energia, 1.0), 0, 1, 0, 200);
		stroke(255, alpha); 
		
		noFill();
		beginShape();
		vertex(this.r1.x, this.r1.y);
		let midX = (this.r1.x + this.r2.x) / 2 + random(-10, 10);
		let midY = (this.r1.y + this.r2.y) / 2 + random(-10, 10);
		quadraticVertex(midX, midY, this.r2.x, this.r2.y);
		endShape();
		pop();
	}
}
