
struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    fn distance(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

trait Shape {
    fn area(&self) -> f64;
}

fn main() {
    let p = Point::new(3.0, 4.0);
    println!("Distance: {}", p.distance());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point() {
        let p = Point::new(3.0, 4.0);
        assert_eq!(p.distance(), 5.0);
    }
}
