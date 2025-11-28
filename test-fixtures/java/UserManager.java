
package com.example;

import java.util.List;
import java.util.ArrayList;

public class UserManager {
    private List<String> users;

    public UserManager() {
        this.users = new ArrayList<>();
    }

    public void addUser(String name) {
        this.users.add(name);
    }

    public String getUser(int index) {
        if (index >= 0 && index < users.size()) {
            return users.get(index);
        }
        return null;
    }

    @Override
    public String toString() {
        return "UserManager with " + users.size() + " users";
    }
}
