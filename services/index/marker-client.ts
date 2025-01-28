export const ParsePDF = async (document_id: string, file: File, forceOCR: boolean) => {
  console.log("Parsing document...");
  
  const tmpFileName = `${document_id}.${file.name.split('.').at(-1)}`;
  const tmpFilePath = `.docs-cache/${tmpFileName}`;
  
  await Bun.write(tmpFilePath, file);
  console.log(`Document was written to cache, ${tmpFileName}`);

  // We can't use Bun's fetch because of the timeout limit of 5 mintues
  const response = await Bun.spawn([
    "curl", 
    "--max-time", "3600",
    "-s",
    "-X", "POST",
    "-F", `force_ocr=${forceOCR}`,
    "-F", "paginate_output=true", 
    "-F", "output_format=markdown",
    "-F", `file=@${tmpFilePath}`,
    "http://localhost:8001/marker/upload"
  ]);
  console.log("Document was sent to marker");

  let output =  { output: "", success: false };
  try {
    output = await new Response(response.stdout).json();
  } catch (e) {
    console.error("Error parsing response from marker", e);
  } finally {
    await Bun.file(tmpFilePath).delete();
    console.log("Document was deleted from cache");
  }

  return output;
}
