
from typing import List, Optional
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str
    email: Optional[str] = None

def process_users(users: List[User]) -> None:
    for user in users:
        print(f"Processing {user.name}")

class UserManager:
    def __init__(self):
        self.users = []

    def add_user(self, user: User):
        self.users.append(user)
        
    @property
    def count(self):
        return len(self.users)

@app.get("/users/{user_id}")
async def get_user(user_id: int):
    return {"id": user_id}
