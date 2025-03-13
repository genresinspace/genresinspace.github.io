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
  // Check if the description starts with the genre name in bold ('''Genre name''')
  const boldGenreRegex = new RegExp(`^'''${genreName}'''\\s*`);
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
  const boldGenreWithTextRegex = new RegExp(`^'''${genreName}'''\\s*,\\s*`);
  if (boldGenreWithTextRegex.test(description)) {
    return description.replace(boldGenreWithTextRegex, "");
  }

  // Handle cases where the genre name appears without being bolded
  const plainGenreRegex = new RegExp(`^${genreName}\\s*`);
  if (plainGenreRegex.test(description)) {
    return description.replace(plainGenreRegex, "");
  }

  return description;
}
