import {Search} from "@mui/icons-material";
import {Autocomplete, Box, TextField} from "@mui/material";
import React, {useEffect, useState} from "react";
import {api} from "../../../api/api";
import {SerieWithProgress, SeriesFilter} from "../../../types/serie";
import {BookWithProgress} from "../../../types/book";
import {useNavigate} from "react-router-dom";
import {goTo} from "../../../helpers/helpers";
import {useSettings} from "../../../contexts/SettingsContext";

export function SearchAutocomplete():React.ReactElement {
    const {siteSettings} = useSettings();
    const [searchQuery, setSearchQuery] = useState("");
    const [foundSeries, setFoundSeries] = useState<SerieWithProgress[]>([]);
    const [foundBooks, setFoundBooks] = useState<BookWithProgress[]>([]);

    const navigate = useNavigate();

    useEffect(()=>{
        async function getSeries():Promise<void> {
            if (searchQuery.length < 2) {
                setFoundSeries([]);
                return;
            }
            const res = await api.get<SeriesFilter>(`series?name=${searchQuery}&limit=5&page=1&sort=sortName`);

            if (!res) return;

            setFoundSeries(res.data);
        }
        async function getBooks():Promise<void> {
            if (searchQuery.length < 2) {
                setFoundBooks([]);
                return;
            }
            const res = await api.get<BookWithProgress[]>(`books?name=${searchQuery}&limit=10&page=1&sort=sortName`);

            if (!res) return;

            setFoundBooks(res);
        }

        const search = setTimeout(()=>{
            void getSeries();
            void getBooks();
        }, 150);

        return ()=>clearTimeout(search);
    }, [searchQuery]);

    function getThumbnail(option:BookWithProgress | SerieWithProgress):string {
        if (option.type === "book") {
            return `${option.seriePath}/${option.imagesFolder}/${option.thumbnailPath}`;
        }
        return option.thumbnailPath;
    }

    return (
        <Autocomplete options={[...foundSeries, ...foundBooks]}
            renderOption={(props, option)=>(
                <Box component="li" sx={{"& > img": {mr: 2, flexShrink: 0}}} {...props}
                    onMouseDown={(e)=>{
                        if (e.button === 1) {
                            if (option.type === "book") {
                                if (siteSettings.openHTML) {
                                    window.open(`/api/static/${option.seriePath}/${option.path}.html`, "_href");
                                    return;
                                }
                                window.open(`/reader/${option._id}`, "_href");
                            } else {
                                window.open(`/app/series/${option._id}`, "_href");
                            }
                        }
                    }}
                >
                    <img loading="lazy" width="50" src={`/api/static/${getThumbnail(option)}`} alt={option.visibleName} />
                    <p className="w-2/3 flex-grow">{option.visibleName}</p>
                </Box>
            )}
            renderInput={(params) => (
                <div className="flex items-center gap-4">
                    <Search className="dark:text-white"/>
                    <TextField {...params} placeholder="Buscar" variant="standard"
                        InputProps={{...params.InputProps, disableUnderline:true}}
                        value={searchQuery}
                    />
                </div>
            )}
            groupBy={(option)=>`${option.type.toUpperCase().replace("BOOK", "LIBRO")}S`}
            onInputChange={(e, v)=>setSearchQuery(v)}
            isOptionEqualToValue={(option, value)=>option.visibleName === value.visibleName || option.sortName === value.sortName}
            getOptionLabel={(option)=>option.visibleName}
            filterOptions={(options) => options}
            onChange={(e, v)=>{
                // Redirigir a la página de la serie
                if (v) {
                    if (v.type === "book") {
                        if (siteSettings.openHTML) {
                            window.location.href = `/api/static/${v.seriePath}/${v.path}.html`;
                            return;
                        }
                        goTo(navigate, `/reader/${v._id}`);
                    } else {
                        goTo(navigate, `/app/series/${v._id}`);
                    }
                }
            }}
            noOptionsText="Busca series o libros de la biblioteca aquí"
        />
    );
}