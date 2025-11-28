package main

import "fmt"

type User struct {
	ID   int
	Name string
}

type UserService interface {
	GetUser(id int) (*User, error)
}

func NewUser(id int, name string) *User {
	return &User{
		ID:   id,
		Name: name,
	}
}

func (u *User) String() string {
	return fmt.Sprintf("User %d: %s", u.ID, u.Name)
}

func main() {
	u := NewUser(1, "Test")
	fmt.Println(u)
}
