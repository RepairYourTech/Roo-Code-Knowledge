
#include <iostream>
#include <vector>
#include <string>

class User {
private:
    int id;
    std::string name;

public:
    User(int id, std::string name) : id(id), name(name) {}

    int getId() const { return id; }
    std::string getName() const { return name; }
};

template <typename T>
T add(T a, T b) {
    return a + b;
}

int main() {
    User u(1, "Test");
    std::cout << u.getName() << std::endl;
    return 0;
}
