import fetch from "node-fetch";
import { search } from "fast-fuzzy";
import { htmlToText } from "html-to-text";
import { filterObjectArray } from "./utils/arrayUtils.js";
import config from "./config.js";
import { errorName } from "./constants/error.js";
import { dataRetrievalConstants } from "./constants/dataRetrieval.js";

const {
  IDC_API_BASE_URL,
  IDC_COLLECTION_BASE_URL,
  IDC_API_COLLECTIONS_ENDPOINT,
  TCIA_API_BASE_URL,
  TCIA_COLLECTION_BASE_URL,
  TCIA_API_COLLECTIONS_ENDPOINT,
  TCIA_API_SERIES_ENDPOINT,
} = dataRetrievalConstants;

/**
 * Retrieves image collection data from the IDC API and filters for collections relevant to ICDC.
 *
 * @async
 * @returns {Promise<string[]>} - Promise that resolves with an array of IDC collections.
 */
async function getIdcCollections() {
  try {
    const response = await fetch(
      `${IDC_API_BASE_URL}${IDC_API_COLLECTIONS_ENDPOINT}`
    );
    const data = await response.json();
    const filteredCollections = filterObjectArray(
      data["collections"],
      "collection_id",
      "icdc_"
    );
    return filteredCollections;
  } catch (error) {
    console.error(error);
    return [];
  }
}

/**
 * Retrieves image collection data from the TCIA API and filters for collection IDs relevant to ICDC.
 *
 * @async
 * @returns {Promise<string[]>} - Promise that resolves with an array of TCIA collection IDs.
 */
async function getTciaCollections() {
  try {
    const response = await fetch(
      `${TCIA_API_BASE_URL}${TCIA_API_COLLECTIONS_ENDPOINT}`
    );
    const data = await response.json();
    const filtered = filterObjectArray(data, "Collection", "ICDC-");
    const collectionIds = filtered.map((obj) => obj.Collection);
    return collectionIds;
  } catch (error) {
    console.error(error);
    return [];
  }
}

/**
 * Retrieves data from TCIA API for a specific TCIA image collection.
 *
 * @async
 * @param {string} collection_id - ID of TCIA image collection.
 * @returns {Promise<Object>} - Promise that resolves with data for specified TCIA collection.
 */
async function getTciaCollectionData(collection_id) {
  try {
    const response = await fetch(
      `${TCIA_API_BASE_URL}${TCIA_API_SERIES_ENDPOINT}${collection_id}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(error);
    return [];
  }
}

/**
 * Retrieves study data from the ICDC backend via a GraphQL query.
 *
 * @async
 * @returns {Promise<Object[]>} - Promise that resolves with an array of ICDC study data objects.
 * @throws {Error} - Throws error if there is an issue connecting to ICDC backend instance.
 */
async function getIcdcStudyData() {
  try {
    const body = JSON.stringify({
      query: `{
              studiesByProgram {
                  clinical_study_designation
                  numberOfImageCollections
                  numberOfCRDCNodes
              }
          }`,
    });
    const response = await fetch(config.BENTO_BACKEND_GRAPHQL_URI, {
      method: "POST",
      body: body,
    });
    const data = await response.json();
    const studyData = data.data?.studiesByProgram;
    return studyData;
  } catch (error) {
    console.error(error);
    throw new Error(errorName.BENTO_BACKEND_NOT_CONNECTED);
  }
}

// /**
//  *
//  *
//  * @param {Object} parameters - Parameters object.
//  * @param {string} parameters.study_code - (Optional) ICDC study code by which to filter collections.
//  * @returns {Promise<Object[]>} - Promise that resolves with an array of collection mappings.
//  * @throws {Error} - Throws error if provided study code is not found in ICDC studies data.
//  */
// function validateStudyCode(studyCode, icdcStudies) {
//   if (
//     studyCode.length > 0 &&
//     !icdcStudies
//       .map((obj) => obj.clinical_study_designation)
//       .includes(studyCode)
//   ) {
//     throw new Error(errorName.STUDY_CODE_NOT_FOUND);
//   }
// }

/**
 * Iterates a list of TCIA collection names and gets corresponding metadata for each collection.
 *
 * @async
 * @param {string[]} tciaCollections - Array of TCIA collection names.
 * @returns {Promise<Object>} - Promise that resolves with an object containing collection data.
 */
async function getTciaCollectionsData(tciaCollections) {
  let tciaCollectionsData = {};
  for (const collection in tciaCollections) {
    const tciaCollectionData = await getTciaCollectionData(
      tciaCollections[collection]
    );
    tciaCollectionsData[tciaCollections[collection]] = tciaCollectionData;
  }
  return tciaCollectionsData;
}

/**
 * Maps collection metadata to a specified IDC collection.
 *
 * @param {string} collectionId - IDC collection name.
 * @param {Object[]} idcCollections - An array of IDC collection data objects.
 * @param {string} icdcStudy - ICDC study name.
 * @returns {Object} - Object containing metadata for specified IDC collection.
 */
function getIdcCollectionMetadata(collectionId, idcCollections, icdcStudy) {
  let idcCollectionMetadata = idcCollections.find(
    (obj) => obj.collection_id === collectionId
  );
  // handle oddly-formatted response HTML for GLIOMA01
  const cleanedDescText = htmlToText(idcCollectionMetadata["description"], {
    wordwrap: null,
  });
  if (icdcStudy.clinical_study_designation === "GLIOMA01") {
    idcCollectionMetadata["description"] = cleanedDescText
      .replace(/\n\n|\s*\[.*?\]\s*/g, " ")
      .replace(/ \./g, ".")
      .replace(" ICDC-Glioma", "");
  } else {
    idcCollectionMetadata["description"] = cleanedDescText;
  }
  return idcCollectionMetadata;
}

/**
 * Maps collection metadata to a specified TCIA collection.
 *
 * @param {string} collectionId - TCIA collection name.
 * @param {Object[]} tciaCollectionsData - Object containing data for TCIA collections.
 * @param {string} icdcStudy - ICDC study name.
 * @returns {Object} - Object containing metadata for specified TCIA collection.
 */
function getTciaCollectionMetadata(
  collectionId,
  tciaCollectionsData,
  icdcStudy
) {
  let tciaCollectionMetadata = tciaCollectionsData[collectionId];
  let totalImages = tciaCollectionMetadata.reduce(
    (tot, obj) => tot + parseInt(obj.ImageCount),
    0
  );
  const totalPatients = [
    ...new Set(tciaCollectionMetadata.map((obj) => obj.PatientID)),
  ].length;
  const uniqueModalities = [
    ...new Set(tciaCollectionMetadata.map((obj) => obj.Modality)),
  ];
  const uniqueBodypartsExamined = [
    ...new Set(tciaCollectionMetadata.map((obj) => obj.BodyPartExamined)),
  ];
  // hardcode inaccessible TCIA data for GLIOMA01
  if (icdcStudy.clinical_study_designation === "GLIOMA01") {
    uniqueModalities.push("Histopathology");
    totalImages += 84;
  }
  return {
    Collection: collectionId,
    Aggregate_PatientID: totalPatients,
    Aggregate_Modality: uniqueModalities,
    Aggregate_BodyPartExamined: uniqueBodypartsExamined,
    Aggregate_ImageCount: totalImages,
  };
}

/**
 * Matches any ICDC-relevant external data to specific ICDC study.
 *
 * @async
 * @param {string} icdcStudy - ICDC study name.
 * @param {Object[]} idcCollections - Array of IDC collection data objects.
 * @param {string[]} tciaCollections - Array of TCIA collection names.
 * @param {string} tciaCollectionsData - Object containing data for TCIA collections.
 * @returns {Promise<Object[]>} - Promise that resolves with array of data collection objects matched to corresponding ICDC study.
 */
async function mapMatchesToStudy(
  icdcStudy,
  idcCollections,
  tciaCollections,
  tciaCollectionsData
) {
  let collectionUrls = [];

  // fuzzy match strings using damerau-levenshtein distance
  let idcMatches = search(
    icdcStudy.clinical_study_designation,
    idcCollections.map((obj) => obj.collection_id)
  );
  let tciaMatches = search(
    icdcStudy.clinical_study_designation,
    tciaCollections
  );

  if (idcMatches.length !== 0) {
    for (const match in idcMatches) {
      const idcCollectionUrl = `${IDC_COLLECTION_BASE_URL}${idcMatches[match]}`;
      const idcCollectionMetadata = await getIdcCollectionMetadata(
        idcMatches[match],
        idcCollections,
        icdcStudy
      );
      collectionUrls.push({
        repository: "IDC",
        url: idcCollectionUrl,
        metadata: idcCollectionMetadata,
      });
    }
  }
  if (tciaMatches.length !== 0) {
    for (const match in tciaMatches) {
      if (tciaCollectionsData[tciaMatches[match]]?.length > 0) {
        const tciaCollectionUrl = `${TCIA_COLLECTION_BASE_URL}${tciaMatches[match]}`;
        let tciaCollectionMetadata = await getTciaCollectionMetadata(
          tciaMatches[match],
          tciaCollectionsData,
          icdcStudy
        );
        collectionUrls.push({
          repository: "TCIA",
          url: tciaCollectionUrl,
          metadata: tciaCollectionMetadata,
        });
      }
    }
  }
  return collectionUrls;
}

/**
 * Collects/assembles external data collection metadata and counts for corresponding ICDC studies.
 *
 * @async
 * @param {string} icdcStudy - ICDC study name.
 * @param {Object[]} idcCollections - Array of IDC collection data objects.
 * @param {string[]} tciaCollections - Array of TCIA collection names.
 * @param {Object[]} tciaCollectionsData - Object containing data for TCIA collections.
 * @returns {Promise<Object[]>} - Promise that resolves with an array of external data collection mappings to relevant ICDC studies.
 */
async function collectMappings(
  icdcStudies,
  idcCollections,
  tciaCollections,
  tciaCollectionsData
) {
  const collectionMappings = [];
  for (const study in icdcStudies) {
    const collectionUrls = await mapMatchesToStudy(
      icdcStudies[study],
      idcCollections,
      tciaCollections,
      tciaCollectionsData
    );
    if (icdcStudies[study]?.numberOfCRDCNodes > 0) {
      collectionMappings.push({
        CRDCLinks: collectionUrls,
        numberOfCRDCNodes: icdcStudies[study]?.numberOfCRDCNodes,
        numberOfImageCollections: icdcStudies[study]?.numberOfImageCollections,
        clinical_study_designation:
          icdcStudies[study]?.clinical_study_designation,
      });
    }
  }
  return collectionMappings;
}

/**
 * Maps ICDC-related data from external APIs to corresponding ICDC studies.
 *
 * @async
 * @returns {Promise<Object[]>} - Promise that resolves with an array of data collection mappings.
 */
async function mapExternalDataToStudies() {
  try {
    const icdcStudies = await getIcdcStudyData();
    const idcCollections = await getIdcCollections();
    const tciaCollections = await getTciaCollections();
    const tciaCollectionsData = await getTciaCollectionsData(tciaCollections);
    const collectionMappings = await collectMappings(
      icdcStudies,
      idcCollections,
      tciaCollections,
      tciaCollectionsData
    );
    return collectionMappings;
  } catch (error) {
    console.error(error);
    return error;
  }
}

// /**
//  * Maps ICDC-related data from external APIs to corresponding ICDC studies.
//  *
//  * @async
//  * @param {Object} parameters - Parameters object.
//  * @param {string} parameters.study_code - (Optional) ICDC study code by which to filter collections.
//  * @returns {Promise<Object[]>} - Promise that resolves with an array of collection mappings.
//  * @throws {Error} - Throws error if provided study code is not found in ICDC studies data.
//  */
// async function mapExternalDataToStudies(studyCode = "") {
//   try {
//     const icdcStudies = await getIcdcStudyData();
//     if (
//       studyCode.length > 0 &&
//       !icdcStudies
//         .map((obj) => obj.clinical_study_designation)
//         .includes(studyCode)
//     ) {
//       throw new Error(errorName.STUDY_CODE_NOT_FOUND);
//     }

//     const idcCollections = await getIdcCollections();
//     const tciaCollections = await getTciaCollections();

//     let tciaCollectionsData = {};
//     let collectionMappings = [];

//     for (const collection in tciaCollections) {
//       const tciaCollectionData = await getTciaCollectionData(
//         tciaCollections[collection]
//       );
//       tciaCollectionsData[tciaCollections[collection]] = tciaCollectionData;
//     }

//     for (const study in icdcStudies) {
//       // fuzzy match strings using damerau-levenshtein distance
//       let idcMatches = search(
//         icdcStudies[study]?.clinical_study_designation,
//         idcCollections.map((obj) => obj.collection_id)
//       );
//       let tciaMatches = search(
//         icdcStudies[study]?.clinical_study_designation,
//         tciaCollections
//       );

//       let collectionUrls = [];

//       if (idcMatches.length !== 0) {
//         for (const match in idcMatches) {
//           const idcCollectionUrl = `${IDC_COLLECTION_BASE_URL}${idcMatches[match]}`;
//           let idcCollectionMetadata = idcCollections.find(
//             (obj) => obj.collection_id === idcMatches[match]
//           );
//           const cleanedDescText = htmlToText(
//             idcCollectionMetadata["description"],
//             { wordwrap: null }
//           );
//           // handle oddly-formatted response HTML for GLIOMA01
//           if (icdcStudies[study]?.clinical_study_designation === "GLIOMA01") {
//             idcCollectionMetadata["description"] = cleanedDescText
//               .replace(/\n\n|\s*\[.*?\]\s*/g, " ")
//               .replace(/ \./g, ".")
//               .replace(" ICDC-Glioma", "");
//           } else {
//             idcCollectionMetadata["description"] = cleanedDescText;
//           }
//           idcCollectionMetadata["__typename"] = "IDCMetadata";
//           collectionUrls.push({
//             repository: "IDC",
//             url: idcCollectionUrl,
//             metadata: idcCollectionMetadata,
//           });
//         }
//       } else {
//         collectionUrls.push({
//           repository: "IDC",
//           url: "API failed",
//         });
//       }
//       if (tciaMatches.length !== 0) {
//         for (const match in tciaMatches) {
//           if (tciaCollectionsData[tciaMatches[match]]?.length > 0) {
//             const tciaCollectionUrl = `${TCIA_COLLECTION_BASE_URL}${tciaMatches[match]}`;
//             let tciaCollectionMetadata =
//               tciaCollectionsData[tciaMatches[match]];
//             let totalImages = tciaCollectionMetadata.reduce(
//               (tot, obj) => tot + parseInt(obj.ImageCount),
//               0
//             );
//             const totalPatients = [
//               ...new Set(tciaCollectionMetadata.map((obj) => obj.PatientID)),
//             ].length;
//             const uniqueModalities = [
//               ...new Set(tciaCollectionMetadata.map((obj) => obj.Modality)),
//             ];
//             const uniqueBodypartsExamined = [
//               ...new Set(
//                 tciaCollectionMetadata.map((obj) => obj.BodyPartExamined)
//               ),
//             ];
//             // hardcode inaccessible TCIA data for GLIOMA01
//             if (icdcStudies[study]?.clinical_study_designation === "GLIOMA01") {
//               uniqueModalities.push("Histopathology");
//               totalImages += 84;
//             }
//             collectionUrls.push({
//               repository: "TCIA",
//               url: tciaCollectionUrl,
//               metadata: {
//                 __typename: "TCIAMetadata",
//                 Collection: tciaMatches[match],
//                 Aggregate_PatientID: totalPatients,
//                 Aggregate_Modality: uniqueModalities,
//                 Aggregate_BodyPartExamined: uniqueBodypartsExamined,
//                 Aggregate_ImageCount: totalImages,
//               },
//             });
//           } else {
//             collectionUrls.push({
//               repository: "TCIA",
//               url: "API failed",
//             });
//           }
//         }
//       } else {
//         collectionUrls.push({
//           repository: "TCIA",
//           url: "API failed",
//         });
//       }
//       if (
//         studyCode &&
//         studyCode === icdcStudies[study]?.clinical_study_designation
//       ) {
//         return collectionUrls;
//       }
//       if (icdcStudies[study]?.numberOfCRDCNodes > 0) {
//         collectionMappings.push({
//           CRDCLinks: collectionUrls,
//           numberOfCRDCNodes: icdcStudies[study]?.numberOfCRDCNodes,
//           numberOfImageCollections:
//             icdcStudies[study]?.numberOfImageCollections,
//           clinical_study_designation:
//             icdcStudies[study]?.clinical_study_designation,
//         });
//       }
//     }
//     console.log(JSON.stringify(collectionMappings));
//     return collectionMappings;
//   } catch (error) {
//     console.error(error);
//     return error;
//   }
// }

export default mapExternalDataToStudies;
