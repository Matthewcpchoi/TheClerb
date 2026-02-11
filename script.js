// Get references to HTML elements
const searchBtn = document.getElementById('searchBtn');
const bookInput = document.getElementById('bookInput');
const resultsDiv = document.getElementById('results');

// Event listener when user clicks "Search"
searchBtn.addEventListener('click', () => {
  const query = bookInput.value; // Get input value
  if (!query) return alert("Type a book name!");

  // Call Google Books API
  fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => displayBooks(data.items))
    .catch(err => console.error(err));
});

// Function to display books
function displayBooks(books) {
  resultsDiv.innerHTML = ""; // Clear previous results
  books.forEach(book => {
    const div = document.createElement('div');
    div.innerHTML = `
      <h3>${book.volumeInfo.title}</h3>
      <p>Author: ${book.volumeInfo.authors ? book.volumeInfo.authors.join(", ") : "Unknown"}</p>
      <p>Published: ${book.volumeInfo.publishedDate || "Unknown"}</p>
    `;
    resultsDiv.appendChild(div);
  });
}
