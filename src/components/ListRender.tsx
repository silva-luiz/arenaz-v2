import { useState } from 'react';

const ListRender = () => {
const [family] = useState([
    {
    id: 1,
    name: "Luiz",
},
{
    id: 2,
    name: "Karla",
},
{
    id: 3,
    name: "Alice",
},
{
    id: 4,
    name: "Theo",
}
]);

const [users, setUsers] = useState([
    {
        id: 1,
        name: "Tchu uí",
        age: 29
    },
    {
        id: 2,
        name: "Tia Karlika",
        age: 25
    },
    {
        id: 3,
        name: "Theo Ravi",
        age: 5
    },
    {
        id: 4,
        name: "Alice Kayaya",
        age: 5
    }
]);

{/* previous state */}
const deleteRandom = () => {
    const randomNumber = Math.floor(Math.random() * users.length);
    setUsers((prevUsers) => prevUsers.filter((user) => randomNumber !== user.id)
    );
};


  return (
    <div>
        <ul>
            {family.map((person) => (
                <li key={person.id}>
                    {person.name}
                </li>
            ))}
        </ul>

        <ul>
            {users.map((user) => (
                <li key={user.id}>
                    Nome: {user.name} - {user.age} anos
                </li>
            ))}
        </ul>
        <button onClick={deleteRandom}>Delete random user</button>
    </div>
  )
}

export default ListRender