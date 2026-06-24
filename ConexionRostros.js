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
		let weight = map(this.energia, 0, 5, 1, 30);
		strokeWeight(weight);
		let alpha = map(min(this.energia, 1.0), 0, 1, 0, 200);
		
		let op1 = this.r1.opacidad !== undefined ? this.r1.opacidad : 120;
		let op2 = this.r2.opacidad !== undefined ? this.r2.opacidad : 120;
		alpha *= min(op1, op2) / 120;

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
