let reverb;

// 🌫️ capas sonoras
const drone = [];
const capa = [];
const capaGrave = [];

// 🫀 pulso
let pulsoOsc, pulsoOsc2;
let pulsoEnv;

let energiaPulso = 0;
let ultimoPulso = 0;

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
