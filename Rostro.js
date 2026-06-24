class Rostro {
	constructor(img) {
		this.img = img;
		this.img.filter(GRAY); // Convertir a blanco y negro
		this.x = random(100, width - 100);
		this.y = random(100, height - 100);
		this.timestamp = millis();
	}

	dibujar() {
		push();
		imageMode(CENTER);
		tint(255, this.opacidad !== undefined ? this.opacidad : 120); 
		image(this.img, this.x, this.y, 100, 100);
		pop();
	}
}
