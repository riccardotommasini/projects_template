// Read queries of the Network view (P4-05), for the network route of the API (P1).
// The graph is built by sync.py; its model is described there. Each query starts with a "// name:" line;
// sync.network_queries() returns them by name. Dates are Neo4j dates; the API serialises them as ISO strings.

// name: leader_country_graph
// Edges of the leader-country graph: VISITED (with the number of visits) and REPRESENTS,
// for the leaders with at least one visit. Nodes are the distinct leaders and countries of the result.
MATCH (l:Leader)-[r:VISITED|REPRESENTS]->(c:Country)
WHERE EXISTS { (l)-[:VISITED]->() }
RETURN l.leader_id AS leader_id, l.name AS leader_name, type(r) AS relation,
       c.iso3 AS iso3, c.name AS country_name,
       r.n_visits AS n_visits, r.days_on_site AS days_on_site,
       r.first_visit AS first_visit, r.last_visit AS last_visit
ORDER BY leader_id, relation, iso3

// name: shared_destinations
// Pairs of leaders who visited the same countries.
MATCH (a:Leader)-[:VISITED]->(c:Country)<-[:VISITED]-(b:Leader)
WHERE a.leader_id < b.leader_id
WITH a, b, c ORDER BY c.iso3
RETURN a.leader_id AS leader_a_id, a.name AS leader_a, b.leader_id AS leader_b_id, b.name AS leader_b,
       count(c) AS n_shared, collect(c.iso3) AS shared_countries
ORDER BY n_shared DESC, leader_a_id, leader_b_id

// name: reciprocal_visits
// Country pairs where a leader of each country visited the other one.
// ponytail: the country of a leader comes from REPRESENTS, so a leader who changed country counts for both;
// carry the visitor country on VISITED if that case shows up in the data.
MATCH (la:Leader)-[:REPRESENTS]->(a:Country), (la)-[x:VISITED]->(b:Country),
      (lb:Leader)-[:REPRESENTS]->(b), (lb)-[y:VISITED]->(a)
WHERE a.iso3 < b.iso3
WITH a, b, la, lb, x, y ORDER BY la.leader_id, lb.leader_id
RETURN a.iso3 AS country_a, b.iso3 AS country_b,
       collect(DISTINCT la.name) AS leaders_a_to_b, collect(DISTINCT lb.name) AS leaders_b_to_a,
       min(x.first_visit) AS first_a_to_b, min(y.first_visit) AS first_b_to_a
ORDER BY country_a, country_b
