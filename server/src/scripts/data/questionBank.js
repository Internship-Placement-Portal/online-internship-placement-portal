// Demo question bank. Format: [text, options, correctIndex, category, difficulty, marks]
const Q = 'Quantitative Aptitude';
const L = 'Logical Reasoning';
const V = 'Verbal Ability';
const C = 'Computer Science';

const mcq = [
  // ── Quantitative Aptitude ──
  ['What is 15% of 240?', ['32', '36', '38', '40'], 1, Q, 'easy', 1],
  ['A train travels at 60 km/h. How long does it take to cover 150 km?', ['2 hours', '2.5 hours', '3 hours', '3.5 hours'], 1, Q, 'easy', 1],
  ['What is the average of 12, 18, 24 and 30?', ['20', '21', '22', '24'], 1, Q, 'easy', 1],
  ['A shirt priced at ₹1000 gets a 20% discount followed by another 10% discount. What is the final price?', ['₹700', '₹720', '₹730', '₹750'], 1, Q, 'medium', 2],
  ['Two numbers are in the ratio 3:5 and their sum is 64. What is the larger number?', ['24', '32', '40', '48'], 2, Q, 'easy', 1],
  ['What is the simple interest on ₹5000 at 8% per annum for 3 years?', ['₹1000', '₹1200', '₹1250', '₹1500'], 1, Q, 'easy', 1],
  ['What is the LCM of 12 and 18?', ['24', '36', '48', '72'], 1, Q, 'easy', 1],
  ['One pipe fills a tank in 6 hours and another in 12 hours. Working together, how long do they take?', ['3 hours', '4 hours', '5 hours', '9 hours'], 1, Q, 'medium', 2],
  ['What is the value of 2^5 + 3^3?', ['53', '57', '59', '61'], 2, Q, 'easy', 1],
  ['A can finish a job in 10 days and B in 15 days. Working together, how many days do they need?', ['5', '6', '7', '8'], 1, Q, 'medium', 2],
  ['A boat goes 12 km/h in still water and the stream flows at 3 km/h. How long does it take to go 45 km downstream?', ['2 hours', '3 hours', '3.5 hours', '4 hours'], 1, Q, 'medium', 2],
  ['A fair coin is tossed twice. What is the probability of getting at least one head?', ['1/2', '2/3', '3/4', '1/4'], 2, Q, 'medium', 2],

  // ── Logical Reasoning ──
  ['What comes next in the series 2, 6, 12, 20, 30, ?', ['40', '42', '44', '36'], 1, L, 'medium', 2],
  ['Which one is the odd one out: Apple, Banana, Carrot, Mango?', ['Apple', 'Banana', 'Carrot', 'Mango'], 2, L, 'easy', 1],
  ['If A=1, B=2, C=3 and so on, what is the value of the word CAT (sum of letter positions)?', ['22', '23', '24', '25'], 2, L, 'easy', 1],
  ['All roses are flowers and all flowers are plants. Which conclusion definitely follows?', ['All plants are roses', 'All roses are plants', 'Some plants are not flowers', 'No rose is a plant'], 1, L, 'easy', 1],
  ['What comes next in the series 1, 4, 9, 16, ?', ['20', '24', '25', '36'], 2, L, 'easy', 1],
  ['What is the angle between the hands of a clock at 3:00?', ['60°', '90°', '120°', '180°'], 1, L, 'easy', 1],
  ['A is the sister of B, and B is the father of C. How is A related to C?', ['Mother', 'Aunt', 'Cousin', 'Grandmother'], 1, L, 'medium', 2],
  ['A man walks 5 km north, then 5 km east, then 5 km south. How far is he from the starting point?', ['0 km', '5 km', '10 km', '15 km'], 1, L, 'medium', 2],
  ['If A=1, B=2, C=3 and so on, what is the sum of letter positions for the word BAD?', ['5', '6', '7', '8'], 2, L, 'easy', 1],
  ['What comes next in the series Z, X, V, T, ?', ['S', 'R', 'Q', 'P'], 1, L, 'easy', 1],
  ['A woman says, "He is the son of my mother\'s only son." How is the man related to her?', ['Brother', 'Nephew', 'Uncle', 'Son'], 1, L, 'hard', 3],
  ['What comes next in the series 3, 9, 27, 81, ?', ['162', '243', '324', '729'], 1, L, 'easy', 1],

  // ── Verbal Ability ──
  ['Choose the synonym of "Abundant".', ['Scarce', 'Plentiful', 'Tiny', 'Costly'], 1, V, 'easy', 1],
  ['Choose the antonym of "Benevolent".', ['Kind', 'Generous', 'Malevolent', 'Gentle'], 2, V, 'medium', 2],
  ['Choose the grammatically correct sentence.', ['He have completed his homework.', 'He has completed his homework.', 'He completed has his homework.', 'He is complete his homework.'], 1, V, 'easy', 1],
  ['Fill in the blank: "Neither of the answers ___ correct."', ['are', 'is', 'were', 'be'], 1, V, 'medium', 2],
  ['What does the idiom "a piece of cake" mean?', ['A dessert', 'Very easy', 'Very costly', 'Very small'], 1, V, 'easy', 1],
  ['What is the one word for "a person who loves books"?', ['Philanthropist', 'Bibliophile', 'Misanthrope', 'Pedant'], 1, V, 'medium', 2],
  ['Choose the correctly spelled word.', ['Acomodation', 'Accomodation', 'Accommodation', 'Acommodation'], 2, V, 'medium', 2],
  ['Fill in the blank: "She is ___ honest woman."', ['a', 'an', 'the', 'no article'], 1, V, 'easy', 1],
  ['Choose the synonym of "Candid".', ['Secretive', 'Frank', 'Rude', 'Shy'], 1, V, 'easy', 1],
  ['Choose the passive form of "The cat chased the mouse."', ['The mouse chased the cat.', 'The mouse was chased by the cat.', 'The mouse is chased by cat.', 'The cat was chased by the mouse.'], 1, V, 'medium', 2],
  ['Choose the antonym of "Expand".', ['Extend', 'Grow', 'Contract', 'Stretch'], 2, V, 'easy', 1],
  ['Fill in the blank: "I have been working here ___ 2019."', ['for', 'since', 'from', 'during'], 1, V, 'easy', 1],

  // ── Computer Science ──
  ['What is the time complexity of binary search on a sorted array?', ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], 1, C, 'easy', 1],
  ['Which data structure follows the LIFO principle?', ['Stack', 'Queue', 'Heap', 'Tree'], 0, C, 'easy', 1],
  ['Which of these is NOT a pillar of object-oriented programming?', ['Encapsulation', 'Inheritance', 'Compilation', 'Polymorphism'], 2, C, 'easy', 1],
  ['Which SQL command quickly removes all rows from a table but keeps its structure?', ['DROP', 'TRUNCATE', 'ALTER', 'REMOVE'], 1, C, 'medium', 2],
  ['Which HTTP status code means "Not Found"?', ['200', '301', '404', '500'], 2, C, 'easy', 1],
  ['What is the worst-case time complexity of quicksort?', ['O(n log n)', 'O(n^2)', 'O(n)', 'O(log n)'], 1, C, 'medium', 2],
  ['Which protocol is connectionless?', ['TCP', 'UDP', 'FTP', 'SMTP'], 1, C, 'easy', 1],
  ['What is the binary representation of the decimal number 10?', ['1001', '1010', '1100', '1110'], 1, C, 'easy', 1],
  ['Which Java keyword prevents a class from being inherited?', ['static', 'final', 'abstract', 'private'], 1, C, 'medium', 2],
  ['How does MongoDB store data?', ['Rows in tables', 'BSON documents', 'Key-only pairs', 'Graph edges'], 1, C, 'easy', 1],
  ['Threads of the same process share which of the following?', ['Stack', 'Registers', 'Heap memory', 'Program counter'], 2, C, 'hard', 3],
  ['Which property describes a primary key?', ['It allows duplicates', 'It uniquely identifies each row', 'It is always a string', 'It can be NULL'], 1, C, 'easy', 1],
];

const coding = [
  ['Write a function fizzBuzz(n) that returns an array of the numbers 1..n, replacing multiples of 3 with "Fizz", multiples of 5 with "Buzz", and multiples of both with "FizzBuzz".', 'Coding', 'easy', 5],
  ['Write a function isPalindrome(s) that returns true if the string reads the same forwards and backwards, ignoring case and non-alphanumeric characters.', 'Coding', 'medium', 5],
  ['Given an array of integers and a target, write a function twoSum(nums, target) that returns the indices of the two numbers that add up to the target.', 'Coding', 'medium', 5],
];

const questions = [
  ...mcq.map(([text, options, correctIndex, category, difficulty, marks]) => ({ text, type: 'mcq', options, correctIndex, category, difficulty, marks })),
  ...coding.map(([text, category, difficulty, marks]) => ({ text, type: 'coding', category, difficulty, marks })),
];

const tests = [
  { title: 'Quantitative Aptitude — Basics', description: 'Percentages, ratios, time and work, probability.', durationMinutes: 15, questionCount: 10, categories: [Q] },
  { title: 'Logical & Verbal Reasoning', description: 'Series, relations, grammar and vocabulary.', durationMinutes: 20, questionCount: 12, categories: [L, V] },
  { title: 'Technical Screening', description: 'Computer science fundamentals plus one coding question.', durationMinutes: 30, questionCount: 10, categories: [C, 'Coding'] },
  { title: 'Full Placement Mock', description: 'Mixed aptitude and technical questions under placement conditions.', durationMinutes: 45, questionCount: 20, categories: [] },
];

module.exports = { questions, tests };
