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
							if (params.pulsosRostros) {
								dispararPulso();
							}
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
