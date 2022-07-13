import fs from 'fs';
import path from 'path';

const requestBody = {
    domain: fs.readFileSync(path.join("pddl2", "domain.pddl"), "utf-8"),
    problem: fs.readFileSync(path.join("pddl2","problem_boil_and_pour1.pddl"),"utf-8"),
    plan: fs.readFileSync(path.join("pddl2", "problem_boil_and_pour1.plan"),"utf-8")
};

fs.writeFileSync(path.join("pddl2", "request.json"), JSON.stringify(requestBody));