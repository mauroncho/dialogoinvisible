class Caminante {

  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.xAnterior = x;
    this.yAnterior = y;
    this.t = 5;
    this.vel = 4;
    this.dir = random(TWO_PI);
    this.nombre = random(nombres);
    push();
    colorMode(HSB, 360, 100, 100);
    this.elColor = color(random(180, 260), 100, 100);
    pop();
  }

  dibujar() {
    // Borrar texto anterior con rectángulo negro sólido
    push();
    fill(0);
    noStroke();
    rect(this.xAnterior - 70, this.yAnterior - 20, 140, 14);
    pop();

    // Dibujar partícula
    push();
    fill(this.elColor);
    noStroke();
    ellipse(this.x, this.y, this.t, this.t);
    pop();

    // Dibujar texto nuevo
    push();
    fill(255);
    noStroke();
    textSize(10);
    textAlign(CENTER);
    text(this.nombre, this.x, this.y - 8);
    pop();
  }

  mover() {
    this.xAnterior = this.x;
    this.yAnterior = this.y;

    this.dir += radians(random(-10, 10));
    let dx = this.vel * cos(this.dir);
    let dy = this.vel * sin(this.dir);
    this.x += dx;
    this.y += dy;
    this.x = (this.x > width  ? this.x - width  : this.x);
    this.x = (this.x < 0     ? this.x + width  : this.x);
    this.y = (this.y > height ? this.y - height : this.y);
    this.y = (this.y < 0     ? this.y + height : this.y);
  }
}