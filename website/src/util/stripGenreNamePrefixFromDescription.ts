/**
 * Strips the genre name prefix from a Wikipedia description.
 *
 * Many Wikipedia descriptions start with the genre name in bold, followed by
 * the actual description. This function removes that prefix to avoid redundancy
 * when displaying the genre name separately from its description.
 *
 * @param genreName The name of the genre to strip from the description
 * @param description The full Wikipedia description text
 * @returns The description with the genre name prefix removed
 */
export function stripGenreNamePrefixFromDescription(
  genreName: string,
  description: string
): string {
  // Handle genre names inside Wikitext templates at the beginning of the description
  // For example: {{Nihongo|'''City pop'''|シティ・ポップ|shiti poppu|lead=yes}}
  if (description.startsWith("{{")) {
    // Find the end of the template, properly handling nested templates
    let nestLevel = 0;
    let templateEnd = -1;

    for (let i = 0; i < description.length - 1; i++) {
      if (description.substring(i, i + 2) === "{{") {
        nestLevel++;
        i++; // Skip the second brace
      } else if (description.substring(i, i + 2) === "}}") {
        nestLevel--;
        i++; // Skip the second brace

        if (nestLevel === 0) {
          templateEnd = i + 1;
          break;
        }
      }
    }

    if (templateEnd > 0) {
      const template = description.substring(0, templateEnd);

      // Check if the template contains the genre name, including variations like hyphenated versions
      const normalizedGenreName = genreName.replace(/\s+/g, "[\\s-]");
      const genreNameRegex = new RegExp(
        `'''${normalizedGenreName}'''|${normalizedGenreName}`,
        "i"
      );

      if (genreNameRegex.test(template)) {
        // Remove the entire template
        const result = description.substring(templateEnd);
        // Clean up leading space if present
        return result.trim();
      }
    }
  }

  // Check if the description starts with the genre name in bold ('''Genre name''')
  // Also handle "The" prefix before the genre name
  const boldGenreRegex = new RegExp(`^(?:The\\s+)?'''${genreName}'''\\s*`, "i");
  if (boldGenreRegex.test(description)) {
    let result = description.replace(boldGenreRegex, "");

    // Further clean up any leading comma and space
    if (result.startsWith(", ")) {
      result = result.substring(2);
    }

    return result;
  }

  // Also handle cases where there might be additional text after the genre name
  // but before the actual description starts
  const boldGenreWithTextRegex = new RegExp(
    `^(?:The\\s+)?'''${genreName}'''\\s*,\\s*`,
    "i"
  );
  if (boldGenreWithTextRegex.test(description)) {
    return description.replace(boldGenreWithTextRegex, "");
  }

  // Handle cases where the genre name appears without being bolded
  const plainGenreRegex = new RegExp(`^(?:The\\s+)?${genreName}\\s*`, "i");
  if (plainGenreRegex.test(description)) {
    return description.replace(plainGenreRegex, "");
  }

  return description;
}
