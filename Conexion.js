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
