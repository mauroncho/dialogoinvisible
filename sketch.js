const entidades = [];
const conexiones = [];

let reverb;
let port; // Puerto serial

// 🌫️ capas sonoras
const drone = [];
const capa = [];
const capaGrave = [];

// ⚡ influencias
const influencias = [];

// 🫀 pulso
let pulsoOsc, pulsoOsc2;
let pulsoEnv;

let energiaPulso = 0;
let ultimoPulso = 0;

function setup() {
	createCanvas(windowWidth, windowHeight);

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
}

function draw() {
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
				const nuevaEntidad = new Entidad(x, y, rssi);
				entidades.push(nuevaEntidad);

				// Si queremos que genere sonido al aparecer
				userStartAudio();
			}
		}
	}

	// ---------------- ENTIDADES ----------------

	const ahora = millis();
	const FADE_DURACION = 3000; // últimos 3 segundos se desvanece

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

	for (let i = 0; i < entidades.length; i++) {
		for (let j = i + 1; j < entidades.length; j++) {
			const a = entidades[i];
			const b = entidades[j];
			const d = dist(a.x, a.y, b.x, b.y);

			if (d < 130 && random() < 0.015) {
				conexiones.push(new Conexion(a, b, d));

				// energía visual
				a.energia += 0.6;
				b.energia += 0.6;

				// influencia sonora
				influencias.push({
					fuerza: map(d, 0, 130, 0.6, 0.2),
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

		const a = map(n, 0, 1, 0.02, 0.035) + empujeAmp;
		d.osc.amp(a, 3);
	}

	// CAPA MEDIA
	for (const c of capa) {
		const n = noise(frameCount * 0.0008 + c.offset);

		const base = map(n, 0, 1, 120, 260);
		const f = base + empujeFreq * 0.2 + densidad * 30;

		c.osc.freq(f);

		const a = map(densidad, 0, 1, 0.005, 0.025) + empujeAmp;
		c.osc.amp(a, 2);
	}

	// CAPA GRAVE
	for (const g of capaGrave) {
		const n = noise(frameCount * 0.00015 + g.offset);

		const base = map(n, 0, 1, 45, 90);
		const f = base + empujeFreq * 0.05;

		g.osc.freq(f);

		const a = map(densidad, 0, 1, 0.03, 0.055) + empujeAmp;
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

		this.x += this.vx * this.velBase;
		this.y += this.vy * this.velBase;

		if (this.x < 0 || this.x > width) this.vx *= -1;
		if (this.y < 0 || this.y > height) this.vy *= -1;

		this.energia *= 0.9;
	}

	dibujar() {
		noStroke();

		for (let i = 5; i > 0; i--) {
			fill(255, 15 * this.opacidad);
			ellipse(this.x, this.y, this.tam * i * 1.4);
		}

		const brillo = constrain(this.energia, 0, 1);

		const alpha = map(brillo, 0, 1, 60, 200) * this.opacidad;
		const tamNucleo = this.tam * map(brillo, 0, 1, 0.6, 1.5);

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
	}

	dibujar() {
		noFill();

		const alpha = map(this.distancia, 0, 130, 80, 15);
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
