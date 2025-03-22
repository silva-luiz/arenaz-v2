import Table from 'react-bootstrap/Table';
import Pagination from 'react-bootstrap/Pagination';
import styles from '../Reservations/ReservationsPage.module.scss';

let active = 1;
let items = [];
for (let number = 1; number <= 5; number++) {
  items.push(
    <Pagination.Item key={number} active={number === active}>
      {number}
    </Pagination.Item>,
  );
}

const reservations = [
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
  {
    arena: 'Arena 1',
    categoria: 'Society',
    locador: 'José da Silva',
    contato: '(12)99123-4456',
    data: '00/00/0000',
    horarioEntrada: '00:00',
    horarioSaida: '02:00',
    valor: 'R$ 130,00',
  },
];

const ReservationsPage = () => {
  return (
    <div>
      <h2>Reservas ativas</h2>
      <p>Confira as informações de todas as suas reservas ativas</p>
      <div className={styles.tableResponsive}>
        <Table
          striped
          bordered
          hover
          variant="dark"
          size="sm"
          className={styles.customTable}
        >
          <thead>
            <tr>
              <th className={styles.tableHeader}>Arena</th>
              <th className={styles.tableHeader}>Categoria</th>
              <th className={styles.tableHeader}>Locador</th>
              <th className={styles.tableHeader}>Contato</th>
              <th className={styles.tableHeader}>Data</th>
              <th className={styles.tableHeader}>Horário</th>
              <th className={styles.tableHeader}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation, index) => (
              <tr key={index} className={styles.tableRow}>
                <td className={styles.tableData}>{reservation.arena}</td>
                <td className={styles.tableData}>{reservation.categoria}</td>
                <td className={styles.tableData}>{reservation.locador}</td>
                <td className={styles.tableData}>{reservation.contato}</td>
                <td className={styles.tableData}>{reservation.data}</td>
                <td className={styles.tableData}>
                  {reservation.horarioEntrada} - {reservation.horarioSaida}
                </td>
                <td className={styles.tableData}>{reservation.valor}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div>
          <Pagination className={styles.reservationPagination}>
            {items}
          </Pagination>
        </div>
      </div>
    </div>
  );
};

export default ReservationsPage;
