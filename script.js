// Grab references to the HTML elements
const searchInput = document.getElementById("book-search");
const searchButton = document.getElementById("search-button");
const resultsDiv = document.getElementById("results");

// Function to fetch books from Google Books API
async function searchBooks() {
  const query = searchInput.value.trim();
  if (!query) return alert("Please type a search term!");

  try {
    // API call
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`
    );
    const data = await response.json();

    // Clear previous results
    resultsDiv.innerHTML = "";

    // If no results
    if (!data.items || data.items.length === 0) {
      resultsDiv.innerHTML = "<p>No results found</p>";
      return;
    }

    // Loop and display
    data.items.forEach((item) => {
      const title = item.volumeInfo.title;
      const authors = item.volumeInfo.authors
        ? item.volumeInfo.authors.join(", ")
        : "Unknown Author";

      const bookEl = document.createElement("div");
      bookEl.style.marginBottom = "12px";
      bookEl.innerHTML = `
        <strong>${title}</strong><br/>
        <em>${authors}</em>
      `;
      resultsDiv.appendChild(bookEl);
    });
  } catch (error) {
    console.error("Error fetching books:", error);
    resultsDiv.innerHTML = "<p>Error fetching results</p>";
  }
}

// Add listener to button
searchButton.addEventListener("click", searchBooks);
